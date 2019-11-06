---
title: K8S
keywords: 
  - kubernetes 
  - 安装
  - HA 
  - 高可用
  - 离线
  - 教程
---
# kubernetes 高可用集群安装
参考资料
> https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/

## Kubernetes核心组件组成

* etcd保存了整个集群的状态
* apiserver提供了资源操作的唯一入口，并提供认证、授权、访问控制、API注册和发现等机制
* controller manager负责维护集群的状态，比如故障检测、自动扩展、滚动更新
* scheduler负责资源的调度，按照预定的调度策略将Pod调度到相应的机器上
* kubelet负责维护容器的生命周期，同时也负责Volume（CVI）和网络（CNI）的管理
* Container runtime负责镜像管理以及Pod和容器的真正运行（CRI）
* kube-proxy负责为Service提供cluster内部的服务发现和负载均衡

除了核心组件，还有一些推荐的Add-ons
* kube-dns负责为整个集群提供DNS服务
* Ingress Controller为服务提供外网入口
* Heapster提供资源监控
* Dashboard提供GUI
* Federation提供跨可用区的集群
* Fluentd-elasticsearch提供集群日志采集、存储与查询


## 在外网机器上的准备工作
* 外网机器需要拉镜像，因此最好具备翻墙条件
* 安装好docker
* 安装 kubeadm

先到这里确定当前最新的k8s版本
https://github.com/kubernetes/kubernetes/releases
我在此时看到的最新版本是v1.16.2
KUBE_VERSION=v1.16.2

### 准备离线镜像文件
可以通过kubeadmin工具来获取离线镜像文件
```sh
# 下载三件套工具集
wget https://dl.k8s.io/{KUBE_VERSION}/kubernetes-server-linux-amd64.tar.gz
# 添加apt源
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
# 安装 docker，kubeadmin
apt-get update
apt-get install -y docker.io kubeadm
# 获取相应版本的镜像信息
kubeadm config images list --kubernetes-version={$KUBE_VERSION}
# 用kubeadmin工具，生成拉去镜像的配置yml文件
kubeadm config print init-defaults > kubeadm.yml
# 拉取镜像
kubeadm config images pull --config kubeadm.yml
# 将镜像到处成一个压缩包
docker save $(docker images | grep -v REPOSITORY | awk 'BEGIN{OFS=":";ORS=" "}{print $1,$2}') -o k8s{$KUBE_VERSION}.tar
```
### 将生成的镜像倒入到内网
在内外安装目标主机上
```
docker load -i k8s{$KUBE_VERSION}.tar
```
## k8s集群的配置
准备好三台centos操作系统的机器，例如app91，app92，app93
每一台机器都需要做一些预先的配置
```
# 打开 ipvs
modprobe -- ip_vs
modprobe -- ip_vs_rr
modprobe -- ip_vs_wrr
modprobe -- ip_vs_sh
modprobe -- nf_conntrack_ipv4
# 添加k8s配置文件
cat <<EOF >  /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
EOF
sysctl --system

sysctl -w net.ipv4.ip_forward=1
systemctl stop firewalld && systemctl disable firewalld
swapoff -a || true
setenforce 0 || true
```
### 解压缩tar文件，然后将二进制文件拷贝到目标路径

```
tar -xvzf kubernetes-server-linux-amd64.tar.gz
sudo cp ./kubernetes/server/bin/* /usr/bin/
```

### 配置 kubelet

```
curl -sSL "https://raw.githubusercontent.com/kubernetes/kubernetes/${RELEASE}/build/debs/kubelet.service" | sed "s:/usr/bin:/opt/bin:g" > /etc/systemd/system/kubelet.service
mkdir -p /etc/systemd/system/kubelet.service.d
curl -sSL "https://raw.githubusercontent.com/kubernetes/kubernetes/${RELEASE}/build/debs/10-kubeadm.conf" | sed "s:/usr/bin:/opt/bin:g" > /etc/systemd/system/kubelet.service.d/10-kubeadm.conf 
```
对照上面在内网操作以下脚本

```
sudo mkdir -p /etc/systemd/system/kubelet.service.d
sudo cp kubelet.service /etc/systemd/system/
sudo cp 10-kubeadm.conf /etc/systemd/system/kubelet.service.d/
systemctl enable --now kubelet
systemctl enable --now kubelet
systemctl status kubelet
```

### 启动K8S
假设192.169.5.180为master1的ip地址，kube api server 的端口为19999，那么 
 ```
 kubeadm init --pod-network-cidr=10.244.0.0/16  \
 --control-plane-endpoint "192.169.5.180:19999" \
 --upload-certs --apiserver-advertise-address=0.0.0.0 \
 --kubernetes-version=v1.16.2
 ```
 返回的信息很丰富，包含以下几个内容
 你需要把init产生的证书和配置信息，拷贝到你的当前用户下，否则日后kubeadm可能无法正常使用
 ```
 Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

 ```
 你可以增加一个master节点
 ```
 You can now join any number of the control-plane node running the following command on each as root:

  kubeadm join 192.169.5.180:19999 --token hm0ci6.u8q041ds6a2mktpm \
    --discovery-token-ca-cert-hash sha256:109e5cea8a867b6b2ab24147ff1e76399976c127400c42e950ef47b3cfb74579 \
    --control-plane --certificate-key 690707d154c80ceed893c6bd8a11520a401fd43df606aeafc27fe64e99b3a67f

 ```
 还可以增加worker节点
 ```
 kubeadm join 192.169.5.180:19999 --token hm0ci6.u8q041ds6a2mktpm \
    --discovery-token-ca-cert-hash sha256:109e5cea8a867b6b2ab24147ff1e76399976c127400c42e950ef47b3cfb74579
 ```
 
::: warning 
但是，token 在两小时内会过期。超过两小时操作的话，上面提示的这些内容就无法执行了，要加入集群除了需要 重新生成一个新的token，同时还需要 Master 节点的 ca 证书 sha256 编码 hash 值
:::

```sh
#重新建立token
kubeadmin token create
# 获取现有证书的sha hash值
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | openssl rsa -pubin -outform der 2>/dev/null | openssl dgst -sha256 -hex | sed 's/^.* //'
# 然后用获取到的token和sha256，替换到join指令里面就行
```
### 安装calico网络，以及dashboard

dashboard的安装在 https://kubernetes.io/docs/tasks/access-application-cluster/web-ui-dashboard/ 有说明
```
curl https://raw.githubusercontent.com/kubernetes/dashboard/v2.0.0-beta4/aio/deploy/recommended.yaml -o recommended.yaml
```
在recommended.yaml将镜像指向本地仓库
另外在NodePort的配置中添加 nodePort:30000,将端口映射到30000端口


```
kubectl create -f calico.yaml
kubectl create -f recommended.yaml
```
### k8s安装ceph支持

参照 https://docs.ceph.com/docs/master/rbd/rbd-kubernetes/ 这里的说明按顺序执行yml文件

在相关镜像已经推送到镜像服务器的情况下，可以执行

> kubectl apply -f csi-config-map.yaml

> kubectl apply -f csi-rbd-secret.yaml

> kubectl apply -f csi-provisioner-rbac.yaml

> kubectl apply -f csi-nodeplugin-rbac.yaml

> kubectl apply -f csi-rbdplugin-provisioner.yaml

> kubectl apply -f csi-rbdplugin.yaml

> kubectl apply -f csi-rbd-sc.yaml

## master节点倒了如何重建
我们模拟一个master节点倒了的情况，例如将master的docker关闭了，再重新开起来
首先，整个集群的状态，要经过一段较长的时间（大概15分钟），才能完全将节点倒掉的情况确认；光看dashboard可能看到的是部分容器还在正常执行，实际已经倒了
等从dashboard上看到准确的状态以后，这时候不能急着将节点加入回来。因为集群目前还是认为有1个节点只是down了，并没有将这个节点删除的，需要删除节点。
```sh
kubectl remove node app91
```
另外，虽然删除了k8s节点，但是etcd也有一个节点倒了，kubectl remove是不会管etcd的（各自可以独立部署的），因此需要手动将异常etcd节点删除。
```sh
# 登陆其中一个还活着的etcd容器
kubectl exec -it etcd-app92 sh -n kube-system
export ETCDCTL_API=3
alias etcdctl='etcdctl --endpoints=https://192.169.5.181:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key'
# 查看etcd节点状态
etcdctl member list
# 找出已经失效的etcd 删除
etcdctl member remove xxxxx
```
将异常的k8s节点从集群中删除
```
kubectl remove node app91
```
然后再重新将节点加入回来就可以了
```
kubeadm join 192.169.5.180:19999 --token hm0ci6.u8q041ds6a2mktpm \
    --discovery-token-ca-cert-hash sha256:109e5cea8a867b6b2ab24147ff1e76399976c127400c42e950ef47b3cfb74579 \
    --control-plane
```
## 部署一个最简单的应用
我们来创建一个web服务
```yaml
FROM python:2.7-alpine
WORKDIR /root
COPY ran.py /root
CMD python /root/ran.py;python -m SimpleHTTPServer 8080
```
其中，ran.py如下
```py
import random,sys
doc = open('/root/index.html','w+')
doc.write(str(random.randint(10, 100)))
doc.close()
```
build完以后，镜像名称为simpleweb，并将镜像推送到镜像仓库
```sh
docker tag simpleweb 192.169.5.7:5000/simpleweb:latest
docker push 192.169.5.7:5000/simpleweb:latest
```
然后编写一个deployment
```yaml
apiVersion: v1
kind: Service
metadata:
  name: simplewebservice
spec:
  type: NodePort
  ports:
  - port: 8080
  selector:
    app: simpleweb
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myweb
spec:
  selector:
    matchLabels:
      app: simpleweb
  template:
    metadata:
      labels:
        app: simpleweb
    spec:
      containers:
      - image: 192.169.5.7:5000/simpleweb:latest
        name: simpleweb
        ports:
          - containerPort: 8080
```
部署这个应用
```
kubectl create -f simpleweb.yaml
```
这个时候，可以看到在dashboard上有一个nodePort 的service
```
simplewebservice:31982 TCP
```
这个31982就是分配在worker节点上的端口号。
访问每个主机的127.0.0.1:31982，都可以访问到这个应用
为了便于外部访问，可以开启一个proxy
```
kube proxy
```
这样可以通过以下链接访问
```sh
http://127.0.0.1:8001/api/v1/namespaces/default/services/simplewebservice/proxy/
```
访问路径遵循以下规律
```
http://kubernetes_master_address/api/v1/namespaces/namespace_name/services/service_name[:port_name]/proxy
```
通过以下指令，可以随时扩展多个副本
```
kubectl scale --replicas=5 -f simpleweb.yaml
```
## tips 

### dashboard访问时报证书错误

打开 https://127.0.0.1:8080 的时候，出现NET::ERR_CERT_INVALID错误
* 在chrome中输入 chrome://flags/
* 将 Allow invalid certificates for resources loaded from localhost 改为enable
* 重新启动浏览器

### 解决在master节点上无法部署pod的问题
k8s 基于安全考虑，在一般情况下是不能直接在master节点上部署pod的，除非手动解除这个限制。
```
kubectl taint nodes --all node-role.kubernetes.io/master-
```
### 控制面haproxy的安装（可选操作）
如果要确保kube api server 的高可用，需要额外做一个haproxy，确保控制面的高可用访问。例如以下配置将三个master 的 6443 端口，映射到19999端口，这样可以确保19999可以高可用访问控制面
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
### kubectl 执行时提示证书错误
```
kubectl get node
Unable to connect to the server: x509: certificate signed by unknown authority (possibly because of "crypto/rsa: verification error" while trying to verify candidate authority certificate "kubernetes")
```
可能是证书没有拷贝到本地路径下
```
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```
### 默认的安装控制面总是先尝试拉外网镜像
```
sudo kubeadm init --control-plane-endpoint "LOAD_BALANCER_DNS:LOAD_BALANCER_PORT" --upload-certs
```

### 访问dashboard的时候需要获取token
```
kubectl -n kube-system describe $(kubectl -n kube-system get secret -n kube-system -o name | grep namespace) | grep token
```

## 常用命令
### k8s管理应用的命令
#### 通过yaml文件创建
```
kubectl create -f xxx.yaml （不建议使用，无法更新，必须先delete）
kubectl apply -f xxx.yaml （创建+更新，可以重复使用）
```
#### 通过yaml文件删除
```
kubectl delete -f xxx.yaml
```
#### 查看namespace下面的pod/svc/deployment
```
kubectl get pod /svc/deployment -n kube-system
kubectl get pod /svc/deployment -n kube-system -o wide （查看存在哪个对应的节点）
```
#### 查看所有namespace下面的pod/svc/deployment
```
kubectl get pod/svc/deployment --all-namcpaces
```
#### 查看所有pod
```
kubectl get pod -n kube-system
```
#### 查看pod描述
```
kubectl describe pod XXX -n kube-system
```
#### 查看pod 日志 
```
kubectl logs xxx -n kube-system（如果pod有多个容器需要加-c 容器名）
```
#### 删除应用
```
kubectl delete deployment xxx -n kube-system
```
#### 根据label删除
```
kubectl delete pod -l app=flannel -n kube-system
```
#### 扩容
```
kubectl scale deployment spark-worker-deployment --replicas=8
```
#### 导出proxy配置文件
```
kubectl get ds -n kube-system -l k8s-app=kube-proxy -o yaml>kube-proxy-ds.yaml
```
#### 导出kube-dns
```
kubectl get deployment -n kube-system -l k8s-app=kube-dns -o yaml >kube-dns-dp.yaml
kubectl get services -n kube-system -l k8s-app=kube-dns -o yaml >kube-dns-services.yaml
```
#### 导出所有 configmap
```
kubectl get configmap -n kube-system -o wide -o yaml > configmap.yaml
```
### 系统维护命令
#### 重启kubelet服务
```
systemctl daemon-reload
systemctl restart kubelet
```
修改启动参数
```
vim /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
```
#### 查看集群信息
```
kubectl cluster-info
```
#### 查看各组件信息
```
kubectl get componentstatuses
```
#### 查看kubelet进程启动参数
```
ps -ef | grep kubelet
```
#### 查看日志
```
sudo journalctl -u kubelet -f
```
#### 设为不可调度状态
```
kubectl cordon node1
```
#### 将pod赶到其他节点
```
kubectl drain node1
```
#### 解除不可调度状态
```
kubectl uncordon node1
```
#### node节点处于schedulingdisabled状态
``` 
kubectl patch node app91 -p '{"spec":{"unschedulable":false}}'
```
#### master运行pod
```
kubectl taint nodes master.k8s node-role.kubernetes.io/master-
```
#### master不运行pod
```
kubectl taint nodes master.k8s node-role.kubernetes.io/master=:NoSchedule
```
#### 获取集群的基本信息
```
kubectl cluster-info
kubectl cluster-info dump
kubectl get nodes
kubectl get namespaces
kubectl get deployment --all-namespaces
kubectl get svc --all-namespaces
kubectl get pod
kubectl get pod -o wide --all-namespaces
kubectl logs podName
```
#### 创建pod或srv
```
kubectl create -f development.yaml
```
#### 检查将要运行的 Pod 的资源状况
```
kubectl describe pod podName
```
#### 删除 Pod
```
kubectl delete pod podName
```
#### pod有多少副本
```
kubectl get rc
```
#### 扩展 Pod
```
kubectl scale --replicas=3 rc podName
```
#### 删除
```
kubectl delete deployment kubernetes-dashboard --namespace=kube-system
kubectl delete svc kubernetes-dashboard --namespace=kube-system
kubectl delete -f kubernetes-dashboard.yaml
```
#### 进入pod
```
kubectl exec -ti podName /bin/bash
```
### 查看类命令
```
获取节点相应服务的信息 ： kubectl get pods 按selector名来查找pod： kubectl get pod --selector name=redis
查看集群信息： kubectl cluster-info
查看各组件信息： kubectl -s http://localhost:8080 get componentstatuses 或 kubectl get cs
查看pods所在的运行节点: kubectl gkubectl get pods -o yamlet pods -o wide
查看pods定义的详细信息： kubectl get pods -o yaml
查看运行pod的环境变量： kubectl exec pod名 env
查看指定pod的日志： kubectl logs -f pods/heapster-xxxxx -n kube-system
```
### 操作类命令
```
创建资源： kubectl apply -f 文件名.yaml kubectl create -f 文件名.yaml
重建资源： kubectl replace -f 文件名 [--force]
删除资源： kubectl delete -f 文件名、kubectl delete pod pod名、kubectl delete rc rc名、kubectl delete service service名
```
### kubectl进阶命令操作
#### kubectl get
```
获取指定资源的基本信息 kubectl get services kubernetes-dashboard -n kube-system #查看所有service
kubectl get deployment kubernetes-dashboard -n kube-system #查看所有发布
kubectl get pods --all-namespaces #查看所有pod
kubectl get pods -o wide --all-namespaces #查看所有pod的IP及节点
kubectl get pods -n kube-system | grep dashboard
kubectl get nodes -l zone #获取zone的节点
```
#### kubectl describe
```
查看指定资源详细描述信息 kubectl describe service/kubernetes-dashboard --namespace="kube-system"
kubectl describe pods/kubernetes-dashboard-349859023-g6q8c --namespace="kube-system" #指定类型查看
kubectl describe pod nginx-772ai #查看pod详细信息
kubectl scale：动态伸缩 kubectl scale rc nginx --replicas=5 # 动态伸缩
kubectl scale deployment redis-slave --replicas=5 #动态伸缩
kubectl scale --replicas=2 -f redis-slave-deployment.yaml #动态伸缩
kubectl exec：进入pod启动的容器 kubectl exec -it redis-master-1033017107-q47hh /bin/bash #进入容器
```
#### kubectl label
添加label值 kubectl label nodes node1 zone=north #增加节点lable值 spec.nodeSelector: zone: north #指定pod在哪个节点
```
kubectl label pod redis-master-1033017107-q47hh role=master #增加lable值 [key]=[value]
kubectl label pod redis-master-1033017107-q47hh role- #删除lable值
kubectl label pod redis-master-1033017107-q47hh role=backend --overwrite #修改lable值
```
#### kubectl rolling-update
滚动升级 
```
kubectl rolling-update redis-master -f redis-master-controller-v2.yaml #配置文件滚动升级
kubectl rolling-update redis-master --image=redis-master:2.0 #命令升级
kubectl rolling-update redis-master --image=redis-master:1.0 --rollback #pod版本回滚
```
### etcdctl常用操作(要进入容器里操作)
> https://www.kubernetes.org.cn/5021.html 
```
#检查网络集群健康状态
ETCDCTL_API=3 etcdctl --cacert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key --cert=/etc/kubernetes/pki/etcd/server.crt  endpoint health
# 检查成员情况
ETCDCTL_API=3 etcdctl --cacert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key --cert=/etc/kubernetes/pki/etcd/server.crt member list
# 检查性能
ETCDCTL_API=3 etcdctl --cacert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key --cert=/etc/kubernetes/pki/etcd/server.crt check perf 
# 日常操作 get/put
https://etcd.io/docs/v3.3.12/demo/
```