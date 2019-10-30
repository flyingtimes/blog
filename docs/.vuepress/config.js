module.exports = {
  extend: '@vuepress/theme-default',
  base: '/blog/',
  title: 'clark的技术博客',
  description: '记录日常点滴技术',
  // 这个插件可以在插入代码段的时候，切换显示多种实现方式
  plugins: [ 'code-switcher' ],
  markdown: {
    // 网址在md中可以自动转化为链接
    linkify:      true,
    extendMarkdown: md => {
      // 使用更多的 markdown-it 插件!
      // md.use(require('markdown-it-xxx'))
    }
  },
  themeConfig: {
    sidebar: 'auto',
    nav: [
      { text: '首页', link: '/' },
      { text: '日课', link: '/everyday' },
      { text: 'K8S', link: '/kubernetes' },
      { text: '百宝箱', link: '/toolbox' },
      { text: '所有文章', link: '/listarticles' },
      { text: '作者简介', link: '/author' },
    ],
  }
}
