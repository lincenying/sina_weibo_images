var colors = require('colors')
colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'red',
    info: 'green',
    data: 'blue',
    help: 'cyan',
    warn: 'yellow',
    debug: 'magenta',
    error: 'red'
})
var node = {
    async: require('async'),
    cheerio: require('cheerio'),
    fs: require('fs'),
    mkdirp: require('mkdirp'),
    path: require('path'),
    request: require('request'),
    url: require('url')
}
var WEIBO_LIKE = {
    /**
     * 配置选项
     */
    options: {
        // 网站地址
        uri: 'http://m.weibo.cn/page/json?containerid=1005055036554104_-_WEIBO_SECOND_PROFILE_LIKE_WEIBO&page=',
        // 保存到此文件夹
        saveTo: './weibo_like',
        // 从第几页开始下载
        startPage: 17,
        endPage: 20,
        // 图片并行下载上限
        downLimit: 2,
        totalPage: 0
    },
    posts: [],
    /**
     * 开始下载（程序入口函数）
     */
    start() {
        var async = node.async
        async.waterfall([
            this.getPages.bind(this)
        ], err => {
            if (err) {
                console.log('error: %s'.error, err.message)
            } else {
                console.log('success: 下载完毕'.info)
            }
        })
    },
    /**
     * 爬取所有列表页
     */
    getPages(callback) {
        var async = node.async
        var i = this.options.startPage || 1
        async.doWhilst(callback => {
            var uri = this.options.uri + '' + i
            i++
            async.waterfall([
                this.downPage.bind(this, uri, i),
                this.parsePage.bind(this),
                this.downAllImages.bind(this)
            ], callback)
        }, page => this.options.endPage > page, callback)
    },
    /**
     * 下载单个页面
     */
    downPage(uri, curpage, callback) {
        console.log('开始下载页面：%s', uri)
        var options = {
            url: uri,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.54 Safari/537.36',
                'Cookie': ''
            }
        }
        node.request(options, (err, res, body) => {
            if (!err) console.log('下载页面成功：%s'.info, uri)
            var page = {
                page: curpage,
                uri,
                html: body
            }
            callback(err, page)
        })
    },
    /**
     * 解析单个页面并获取数据
     */
    parsePage(page, callback) {
        console.log('开始分析页面数据：%s', page.uri)
        var json = JSON.parse(page.html)
        var card_group = json.cards[0].card_group
        this.posts = []
        for (var i=0, length = card_group.length; i<length; i++) {
            if (card_group[i].mblog.pics) {
                var title = card_group[i].mblog.text
                title = title.replace(/<.*?>/ig, '').replace(/[<|>|\||:|\|/|?]+/g, "").replace(/"/g, '')
                this.posts.push({
                    loc: card_group[i].mblog.pics,
                    title
                })
            }
        }
        console.log('分析页面数据成功，共%d篇', card_group.length)
        callback(null, page.page)
    },
    /**
     * 下载全部图片
     */
    downAllImages(page, callback) {
        var async = node.async
        console.log('开始全力下载所有图片，共%d篇', this.posts.length)
        async.eachSeries(this.posts, this.downPostImages.bind(this), () => {
            callback(null, page)
        })
    },
    /**
     * 下载单个页面的图片
     * @param  {Object} post
     */
    downPostImages(post, callback) {
        var async = node.async
        async.waterfall([
            this.mkdir.bind(this, post),
            this.parsePost.bind(this),
            this.downImages.bind(this),
        ], callback)
    },
    /**
     * 创建目录
     */
    mkdir(post, callback) {
        var path = node.path
        post.dir = path.join(this.options.saveTo, post.title)
        console.log('准备创建目录：%s', post.dir)
        if (node.fs.existsSync(post.dir)) {
            callback(null, post)
            console.log('目录：%s 已经存在'.error, post.dir)
            return
        }
        node.mkdirp(post.dir, function(err) {
            callback(err, post)
            console.log('目录：%s 创建成功'.info, post.dir)
        })
    },
    /**
     * 解析post，并获取post中的图片列表
     */
    parsePost(post, callback) {
        var pics = post.loc
        post.arrSrc = []
        for (var i=0, length=pics.length; i<length; i++) {
            post.arrSrc.push(pics[i].url.replace('thumb180', 'large'))
        }
        callback(null, post)
    },
    /**
     * 下载post图片列表中的图片
     */
    downImages(post, callback) {
        console.log('发现%d张图片，准备开始下载...', post.arrSrc.length)
        node.async.eachLimit(post.arrSrc, this.options.downLimit, this.downImage.bind(this, post), callback)
    },
    /**
     * 下载单个图片
     */
    downImage(post, imgsrc, callback) {
        var url = node.url.parse(imgsrc)
        var fileName = node.path.basename(url.pathname)
        var toPath = node.path.join(post.dir, fileName)
        console.log('开始下载图片：%s，保存到：%s', fileName, post.dir)
        node.request(encodeURI(imgsrc)).pipe(node.fs.createWriteStream(toPath)).on('close', () => {
            console.log('图片下载成功：%s'.info, imgsrc)
            callback(null)
        }).on('error', callback)
    }
}
WEIBO_LIKE.start()
