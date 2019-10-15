cd docs/.vuepress/dist
git init
git add -A
git commit -m 'deploy'
git push -f https://github.com/flyingtimes/tutorial_startup.git master:gh-pages
cd ../../../
