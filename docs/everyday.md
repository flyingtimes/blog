# 日课
![avatar](monk.jpg)

> 一个人的前程，往往全靠他怎样利用闲暇时间，闲暇定终生。

*每天腾出一小时来，完善自己的技术栈*

## 先开一个坑，vuepress
> 用vuepress搭一个github上的博客，同时作为样本深入学习下vue。

### 2019.10.20

要学习如何做theme，首先可以**弹出**一份default的theme做参考，导出方法集成在vuepress-cli里面了
```
vuepress eject docs
```
这时候在项目docs路径下会产生一个新的theme路径
```
docs
    .vuepress
    L theme
        L components
        L global-comonents
        L layouts
        L util
        index.js
```

声明我们要生成一个在default主题集成上扩展的自定义主题，在docs/.vuepress/config.js 中加入
``` js {2}
module.exports = {
extend: '@vuepress/theme-default'
    ...
}
```
::: warning
eject以后，原来的default主题就失效了，页面主题都以docs/.vuepress/theme为准
:::
ok，现在可以开始尝试对default主题做一些修改了
例如，要修改home页面hero图片为圆角，可以在docs/.vuepress/components/Home.vue中添加一行
``` js {7}
  .hero
    img
      max-width: 100%
      max-height 280px
      display block
      margin 3rem auto 1.5rem
      border-radius 50px
    text-align center
```
要修改代码的底色，可以在 docs/.vuepress/styles/code.styl 中修改颜色
``` js {3}
div[class*="language-"]
  position relative
  background-color  #389d70
```
### 2019.10.21
昨天基本搞清楚如何做自定义theme了，下来研究一下，vuepress的内部机制是如何发挥作用的。可以参考简书作者云峰的文章。

[深入浅出 VuePress（一）：如何做到在 Markdown 中使用 Vue 语法](https://www.jianshu.com/p/c7b2966f9d3c)

[深入浅出 VuePress（二）：使用 Webpack-chain 链式生成 webpack 配置](https://www.jianshu.com/p/a63b55b1d9cc)

[深入浅出 VuePress（三）：使用 markdown-it 解析 markdown 代码](https://www.jianshu.com/p/a95c04a68d14)

[深入浅出 VuePress（四）：插件系统](https://www.jianshu.com/p/b8000f6b24da)

