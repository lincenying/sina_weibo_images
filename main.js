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
var userid = "103003index2968135687";
var weiboImages = {
    /**
     * 配置选项
     */
    options: {
        // 网站地址
        uri: 'http://m.weibo.cn/page/json?containerid=' + userid + '_-_photo_all_l&page=',
        // 保存到此文件夹
        saveTo: './images',
        // 从第几页开始下载
        startPage: 60,
        // 图片并行下载上限
        downLimit: 5,
        totalPage: 0,
        postFolerFormat: ''
    },
    posts: [],
    /**
     * 开始下载（程序入口函数）
     */
    start() {
        var async = node.async;
        async.waterfall([
            this.getPages.bind(this),
            this.downAllImages.bind(this)
        ], (err, result) => {
            if (err) {
                console.log('error: %s', err.message);
            } else {
                console.log('success: 下载成功');
            }
        });
    },
    /**
     * 爬取所有相册列表页
     */
    getPages(callback) {
        var async = node.async;
        var i = this.options.startPage || 1;
        async.doWhilst((callback) => {
            var uri = this.options.uri + '' + i;
            i++;
            async.waterfall([
                this.downPage.bind(this, uri),
                this.parsePage.bind(this)
            ], callback);
        }, (postsNum) => {
            return postsNum > 0;
        }, callback);
    },
    /**
     * 下载单个页面
     */
    downPage(uri, callback) {
        console.log('开始下载页面：%s', uri);
        var options = {
            url: uri,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.63 Safari/537.36',
                'Cookie': ''
            }
        };
        node.request(options, (err, res, body) => {
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
    parsePage(page, callback) {
        console.log('开始分析页面数据：%s', page.uri);
        var json = JSON.parse(page.html);
        var arr_page = page.uri.split("page="),
            curpage = arr_page[1];
        var $posts = json.cards[0].card_group && json.cards[0].card_group[0].pics || [],
            $list;
        if ($posts.length) this.options.totalPage = curpage;
        for (var i = 0; i < $posts.length; i++) {
            $list = $posts[i];
            this.posts.push({
                curpage: curpage,
                id: $list.object_id,
                pics: $list.pic_ori
            });
        };
        console.log('分析页面数据成功，共%d篇', $posts.length);
        callback(null, $posts.length);
    },
    /**
     * 下载全部图片
     */
    downAllImages(callback) {
        var async = node.async;
        console.log('开始全力下载所有图片，共%d篇', this.posts.length);
        async.eachSeries(this.posts, this.downImage.bind(this), callback);
    },
    /**
     * 下载单个图片
     */
    downImage(post, callback) {
        var imgsrc = post.pics;
        var url = node.url.parse(imgsrc);
        var fileName = node.path.basename(url.pathname);
        var toPath = node.path.join(this.options.saveTo, fileName);
        console.log('开始下载图片：%s，保存到：%s，页数：%s / %s', fileName, this.options.saveTo, post.curpage, this.options.totalPage);
        node.request(encodeURI(imgsrc)).pipe(node.fs.createWriteStream(toPath)).on('close', function() {
            console.log('图片下载成功：%s', imgsrc);
            callback();
        }).on('error', callback);
    }
};
weiboImages.start();
