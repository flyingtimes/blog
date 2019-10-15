# 前端技术

## vuepress

安装vuepress
```bash
npm install -g vuepress
git clone https://github.com/flyingtimes/tutorial_startup.git your-project-name
npm install --save
```
在插件code-switcher 中，有三处代码使用了localstorage，需要去掉
```
node_modules/vuepress-plugin-code-switcher/CodeSwitcher.vue 
```
在配置文件中，需要把base路径修改成你的项目路径
```config.js
base: '/your-project-name/',
```


