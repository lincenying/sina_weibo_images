# weibo图片抓取

```
app.js // 微博用户相册图片抓取 (async库 + request库 + cheerio库)
main.js // 微博用户相册图片抓取 (async库 + request库 + cheerio库)
bcy.js // 半次元赞过的COS作品抓取 (async库 + request库 + cheerio库)
bluebird.js // 半次元COS作品抓取 (bluebird库 + request库 + cheerio库)
tomiaaa.js // tomiaaa个人博客图片抓取 (async库 + request库 + cheerio库)
weibo_like.js // 赞过的微博图片抓取 (async库 + request库 + cheerio库)
```

1. 安装nodejs
2. git clone
3. npm install
4. 修改app.js中的userid和weiboname
5. node app.js 开始抓取吧...

### 如何获取userid?
```
打开你想抓取的用户微博, 点击页面上的"他/她的相册", 地址栏中的/p/一串数字/album 中的一串数字即为userid

weiboname为保存图片的文件夹名称
```
