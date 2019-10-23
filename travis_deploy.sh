vuepress build docs
cd docs/.vuepress/dist
git init
git add -A
git commit -m 'deploy'
git push -f https://${mytoken}@github.com/flyingtimes/blog.git master:gh-pages
