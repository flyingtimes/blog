## 安装

```
git clone https://github.com/flyingtimes/blog.git
export HTTPS_PROXY=http://127.0.0.1:1087 && yarn install
vuepress dev docs   # 本地localhost调测，带hot reload
vuepress build docs  # 编译输出到docs/.vuepress/dist
bash deploy.sh    # 将编译结果部署到github的静态网址
```