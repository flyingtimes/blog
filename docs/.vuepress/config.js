module.exports = {
  extend: '@vuepress/theme-default',
  base: '/blog/',
  title: 'clark的技术博客',
  description: '记录日常点滴技术',
  plugins: [ 'code-switcher' ],
  themeConfig: {
    sidebar: 'auto',
    nav: [
      { text: '首页', link: '/' },
      { text: '日课', link: '/everyday' },
      { text: '百宝箱', link: '/toolbox' },
      { text: '作者简介', link: '/author' },
    ],
  }
}
