var node = {
    async: require('async'),
    cheerio: require('cheerio'),
    ejs: require('ejs'),
    fs: require('fs'),
    mkdirp: require('mkdirp'),
    path: require('path'),
    request: require('request'),
    url: require('url'),
    xml2js: require('xml2js'),
};
// 用户ID
var userid = "1005051671578317",
    weiboname = "橘玄叶MACX邪恶的小芽";
var weiboImages = {
    /**
     * 配置选项
     */
    options: {
        // 网站地址
        uri: 'http://m.weibo.cn/page/json?containerid=' + userid + '_-_WEIBO_SECOND_PROFILE_WEIBO&page=',
        // 保存到此文件夹
        saveTo: './images',
        // 从第几页开始下载
        startPage: 1,
        // 图片并行下载上限
        downLimit: 5,
        totalPage: 0,
        postFolerFormat: ''
    },
    posts: [],
    /**
     * 开始下载（程序入口函数）
     */
    start: function() {
        var self = this;
        var async = node.async;
        async.waterfall([
            self.wrapTask(self.getPages),
            self.wrapTask(self.downAllImages),
        ], function(err, result) {
            if (err) {
                console.log('error: %s', err.message);
            } else {
                console.log('success: 下载成功');
            }
        });
    },
    /**
     * 包裹任务，确保原任务的上下文指向某个特定对象
     * @param  {Function} task 符合async.js调用方式的任务函数
     * @param  {Any} context 上下文
     * @param  {Array} exArgs 额外的参数，会插入到原task参数的前面
     * @return {Function} 符合async.js调用方式的任务函数
     */
    wrapTask: function(task, context, exArgs) {
        var self = this;
        return function() {
            var args = [].slice.call(arguments);
            args = exArgs ? exArgs.concat(args) : args;
            task.apply(context || self, args);
        };
    },
    /**
     * 爬取所有微博列表页
     */
    getPages: function(callback) {
        var self = this;
        var async = node.async;
        var i = self.options.startPage || 1;
        async.doWhilst(function(callback) {
            var uri = self.options.uri + '' + i;
            i++;
            async.waterfall([
                self.wrapTask(self.downPage, self, [uri]),
                self.wrapTask(self.parsePage)
            ], callback);
        }, function(postsNum) {
            return postsNum > 0;
        }, callback);
    },
    /**
     * 下载单个页面
     */
    downPage: function(uri, callback) {
        console.log('开始下载页面：%s', uri);
        node.request(encodeURI(uri), function(err, res, body) {
            if (!err) console.log('下载页面成功：%s', uri);
            var page = {
                uri: uri,
                html: body
            };

            callback(err, page);
        });
    },
    /**
     * 解析单个页面并获取数据
     */
    parsePage: function(page, callback) {
        console.log('开始分析页面数据：%s', page.uri);
        var self = this;
        var json = JSON.parse(page.html);
        var arr_page = page.uri.split("page="),
            curpage = arr_page[1];
        var $posts = json.cards[0].card_group || [],
            $list;
        if ($posts.length) self.options.totalPage = curpage;
        for (var i = 0; i < $posts.length; i++) {
            $list = $posts[i].mblog;
            self.posts.push({
                curpage: curpage,
                id: $list.mid,
                pics: $list.pics,
                created_timestamp: $list.created_timestamp,
                text: $list.text
            });
        };
        console.log('分析页面数据成功，共%d篇', $posts.length);
        callback(null, $posts.length);
    },
    /**
     * 下载全部图片
     */
    downAllImages: function(callback) {
        var self = this;
        var async = node.async;
        console.log('开始全力下载所有图片，共%d篇', self.posts.length);
        async.eachSeries(self.posts, self.wrapTask(self.downPostImages), callback);
    },
    /**
     * 下载单条微博的图片
     * @param  {Object} post 微博
     */
    downPostImages: function(post, callback) {
        var self = this;
        var async = node.async;
        async.waterfall([
            self.wrapTask(self.mkdir, self, [post]),
            self.wrapTask(self.parsePost),
            self.wrapTask(self.downImages),
        ], callback);
    },
    mkdir: function(post, callback) {
        var path = node.path;
        var timestamp = post.created_timestamp;
        var postFolder = this.formatDate(timestamp);
        saveTo = path.join(this.options.saveTo, weiboname);
        post.dir = path.join(saveTo, postFolder);
        console.log('准备创建目录：%s', post.dir);
        if (!post.pics) {
            callback(null, post);
            console.log('当前微博没有图片, 放弃创建目录：%s', post.dir);
        } else {
            if (node.fs.existsSync(post.dir)) {
                callback(null, post);
                console.log('目录：%s 已经存在', post.dir);
                return;
            }
            node.mkdirp(post.dir, function(err) {
                callback(err, post);
                console.log('目录：%s 创建成功', post.dir);
            });
        }
    },
    /**
     * 解析post，并获取post中的图片列表
     */
    parsePost: function(post, callback) {
        var pics = post.pics || [],
            picsrc;
        post.images = [];
        for (var i = 0; i < pics.length; i++) {
            picsrc = pics[i].url;
            picsrc = picsrc.replace("wap180", "large");
            picsrc = picsrc.replace("thumb180", "large");
            post.images.push(picsrc)
        }
        callback(null, post);
    },
    /**
     * 下载post图片列表中的图片
     */
    downImages: function(post, callback) {
        console.log('发现%d张图片，准备开始下载...', post.images.length);
        node.async.eachLimit(post.images, this.options.downLimit, this.wrapTask(this.downImage, this, [post]), callback);
    },
    /**
     * 下载单个图片
     */
    downImage: function(post, imgsrc, callback) {
        var url = node.url.parse(imgsrc);
        var fileName = node.path.basename(url.pathname);
        var toPath = node.path.join(post.dir, fileName);
        console.log('开始下载图片：%s，保存到：%s，页数：%s / %s', fileName, post.dir, post.curpage, this.options.totalPage);
        node.request(encodeURI(imgsrc)).pipe(node.fs.createWriteStream(toPath)).on('close', function() {
            console.log('图片下载成功：%s', imgsrc);
            callback();
        }).on('error', callback);
    },
    /**
     * 格式化时间戳
     */
    formatDate: function(str) {
        var d = new Date(str * 1000),
            year = d.getFullYear(),
            month = d.getMonth() + 1,
            date = d.getDate(),
            hour = d.getHours(),
            minute = d.getMinutes(),
            second = d.getSeconds();
        month = month < 10 ? ("0" + month) : month;
        date = date < 10 ? ("0" + date) : date;
        hour = hour < 10 ? ("0" + hour) : hour;
        minute = minute < 10 ? ("0" + minute) : minute;
        second = second < 10 ? ("0" + second) : second;
        return year + "-" + month + "-" + date + " " + hour + "_" + minute + "_" + second;
    }
};
weiboImages.start();
