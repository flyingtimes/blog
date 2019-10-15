module.exports = {
  base: '/blog/',
  title: 'XXX的教程',
  description: '一个基本的课程框架',
  plugins: [ 'code-switcher' ],
  themeConfig: {
    sidebar: 'auto',
    nav: [
      { text: '首页', link: '/' },
      { text: '快速教程', link: '/tutorial' },
      { text: '文档', link: '/documentation' },
      { text: '作者简介', link: '/author' },
    ],
    
  }
}
