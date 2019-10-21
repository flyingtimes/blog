module.exports = {
  base: '/blog/',
  title: 'clark的技术博客',
  description: '记录日常点滴技术',
  plugins: [ 'code-switcher' ],
  themeConfig: {
    sidebar: 'auto',
    nav: [
      { text: '首页', link: '/' },
      { text: '容器化', link: '/container' },
      { text: '日课', link: '/everyday' },
      { text: '前端技术', link: '/frontend' },
      { text: '后端技术', link: '/backend' },
      { text: '作者简介', link: '/author' },
    ],
    
  }
}
