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