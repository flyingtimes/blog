<template>
  <div>
    <div class="article" v-for="page in files">
      <a v-bind:href="page.path">{{page.title}}</a>
      <div class="keywords">
        <span class="keyword" v-for="key in page.frontmatter.keywords">{{key}}</span>
      </div>
    </div>
  </div>
</template>
<script>
export default {
  computed: {
    files() {
      return this.$site.pages
        .filter(p => { 
          return (!p.frontmatter.home) && (!p.frontmatter.showList);
        });
    }
  }
}
</script>
<style scoped>
  .article {
    margin-bottom: 10px;
    border-left: solid 5px #3eaf7c;
    padding: 10px;
  }
  .keywords {
    margin-top: 10px;
  }
  .keyword {
    padding: 5px;
    border-radius: 5px;
    font-size: medium;
    background: #3eaf7c;
    margin-right: 5px;
    color: white;
    font-weight: 500;
  }
</style>