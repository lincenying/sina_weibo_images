var colors = require('colors')
var Promise = require('bluebird')
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
    cheerio: require('cheerio'),
    fs: require('fs'),
    mkdirp: require('mkdirp'),
    path: require('path'),
    request: require('request'),
    url: require('url'),
    options: {
        // 网站地址
        uri: 'http://bcy.net/coser/allwork?&p=',
        // 保存到此文件夹
        saveTo: './test',
        // 从第几页开始下载
        startPage: 1,
        // 到第一页结束
        endPage: 1,
        // 图片并行下载上限
        downLimit: 5
    },
    posts: []
}

function getIndex() {
    return new Promise((resolve, reject) => {
        var options = {
            url: node.options.uri + 2272,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.54 Safari/537.36',
                'Cookie': 'lang_set=zh;'
            }
        }
        node.request(options, (err, res, body) => {
            if (err) {
                reject(err)
            } else {
                var page = {
                    page: 1,
                    uri: '',
                    html: body
                }
                resolve(page)
            }
        })
    })
}

function parseIndex(data) {
    var $ = node.cheerio.load(data.html)
    var $posts = $('.grid__inner > li')
    var src = []
    $posts.each(function() {
        var href = "http://bcy.net" + $(this).find(".work-thumbnail__bd").find("a").attr('href')
        src.push(href)
    })
    var post = {
        page: data.page,
        loc: src,
        title: "page" + data.page
    }
    return post
}
function downImage(imgsrc) {
    return new Promise(resolve => {
        imgsrc = imgsrc.replace("/w650", "")
        var url = node.url.parse(imgsrc)
        var fileName = node.path.basename(url.pathname)
        fileName = fileName.split("?")[0]
        var toPath = node.path.join(node.options.saveTo, fileName)
        console.log('开始下载图片：%s', fileName)
        node.request.get(encodeURI(imgsrc), {
            timeout: 20000
        }, function(err) {
            if (err) {
                console.log('图片下载失败, code = ' + err.code + '：%s'.error, imgsrc)
                resolve(imgsrc + " => 0")
            }
        }).pipe(node.fs.createWriteStream(toPath)).on('close', () => {
            console.log('图片下载成功：%s'.info, imgsrc)
            resolve(imgsrc + " => 1")
        }).on('error', () => {
            resolve(imgsrc + " => 0")
        })
    })
}



function getOnePageImg(data) {
    var $ = node.cheerio.load(data.html)
    var $posts = $('.detail_std')
    var src = []
    $posts.each(function() {
        var href = $(this).attr('src')
        src.push(href)
    })
    return Promise.mapSeries(src, item => {
        return downImage(item)
    }, 3)
}

function getOnePage(item) {
    return new Promise((resolve, reject) => {
        console.log('start: ' + item)
        var options = {
            url: item,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.54 Safari/537.36',
                'Cookie': 'lang_set=zh;'
            }
        }
        node.request(options, (err, res, body) => {
            if (err) {
                reject(err)
            } else {
                var page = {
                    page: 1,
                    uri: '',
                    html: body
                }
                resolve(page)
            }
        })
    }).then(data => {
        return getOnePageImg(data)
    })
}

getIndex().then(data => {
    return parseIndex(data)
}).then(data => {
    return Promise.mapSeries(data.loc, item => {
        return getOnePage(item)
    })
}).then(data => {
    console.log(data)
})
