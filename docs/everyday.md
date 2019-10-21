# 日课
> 一个人的前程，往往全靠他怎样利用闲暇时间，闲暇定终生。

*每天腾出一小时来，完善自己的技术栈*

## 第一个小目标
> 以vuepress为研究对象，学习如何做theme，从而了解vuejs

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

