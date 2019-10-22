<template>
  

  <main class="page">
    <slot name="top" />
    <Content class="theme-default-content" />
    <List v-if="$page.frontmatter.showList"/>

    <PageEdit />

    <PageNav v-bind="{ sidebarItems }" />

    <slot name="bottom" />
  </main>
</template>

<script>
import PageEdit from '@theme/components/PageEdit.vue'
import PageNav from '@theme/components/PageNav.vue'
import List from '../components/List.vue'

export default {
  components: { PageEdit, PageNav,List },
  props: ['sidebarItems']
}
</script>

<style lang="stylus">
@require '../styles/wrapper.styl'

.page
  padding-bottom 2rem
  display block

</style>
