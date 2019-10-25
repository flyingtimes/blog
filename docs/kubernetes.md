haproxy的安装
```
yum install haproxy
```

```sh
frontend k8s_lb
        bind *:19999
        mode tcp
        default_backend controlPlaneNode
listen  controlPlaneNode
        mode tcp
        option tcplog
        balance source
        server app91 app91:6443 weight 1 check inter 2000 rise 2 fall 3
        server app92 app92:6443 weight 1 check inter 2000 rise 2 fall 3
        server app93 app93:6443 weight 1 check inter 2000 rise 2 fall 3
```
```
service start haproxy
```
默认的安装控制面要拉外网镜像
```
sudo kubeadm init --control-plane-endpoint "LOAD_BALANCER_DNS:LOAD_BALANCER_PORT" --upload-certs
```
访问dashboard的方法
首先获取token
```
kubectl proxy
kubectl -n kube-system describe $(kubectl -n kube-system get secret -n kube-system -o name | grep namespace) | grep token
```
访问网址
```
http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```