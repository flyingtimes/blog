# kubernetes 高可用集群安装
参考资料
> https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/
> https://github.com/kubernetes/kubeadm/issues/1315


## 下载官方安装包
```
https://dl.k8s.io/v1.16.2/kubernetes-server-linux-amd64.tar.gz
```

## 配置 kubelet

```
curl -sSL "https://raw.githubusercontent.com/kubernetes/kubernetes/${RELEASE}/build/debs/kubelet.service" | sed "s:/usr/bin:/opt/bin:g" > /etc/systemd/system/kubelet.service
mkdir -p /etc/systemd/system/kubelet.service.d
curl -sSL "https://raw.githubusercontent.com/kubernetes/kubernetes/${RELEASE}/build/debs/10-kubeadm.conf" | sed "s:/usr/bin:/opt/bin:g" > /etc/systemd/system/kubelet.service.d/10-kubeadm.conf 
```
* 内网操作以下脚本

```
sudo mkdir -p /etc/systemd/system/kubelet.service.d
sudo cp kubelet.service /etc/systemd/system/
sudo cp 10-kubeadm.conf /etc/systemd/system/kubelet.service.d/
systemctl enable --now kubelet
systemctl status kubelet
```
systemctl enable --now kubelet
systemctl status kubelet


## 离线镜像准备
>
需要在外网机器操作
>

```
wget https://dl.k8s.io/v1.16.2/kubernetes-server-linux-amd64.tar.gz
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
apt-get install -y docker.io kubelet kubeadm kubectl kubernetes-cni
#
kubeadm config images list --kubernetes-version=1.16.2
k8s.gcr.io/kube-apiserver:v1.16.2
k8s.gcr.io/kube-controller-manager:v1.16.2
k8s.gcr.io/kube-scheduler:v1.16.2
k8s.gcr.io/kube-proxy:v1.16.2
k8s.gcr.io/pause:3.1
k8s.gcr.io/etcd:3.3.15-0
k8s.gcr.io/coredns:1.6.2
#
kubeadm config print init-defaults > kubeadm.yml
#
kubeadm config images pull --config kubeadm.yml
#
docker save $(docker images | grep -v REPOSITORY | awk 'BEGIN{OFS=":";ORS=" "}{print $1,$2}') -o k8s1.16.2.tar
```

## 导入镜像
```
docker load -i k8s1.16.2.tar
```

## 启动K8S
 
 ```
 kubeadm init --pod-network-cidr=10.244.0.0/16  \
 --control-plane-endpoint "192.169.5.180:19999" \
 --upload-certs --apiserver-advertise-address=0.0.0.0 \
 --kubernetes-version=v1.16.2
 ```
 
 ```
 You can now join any number of the control-plane node running the following command on each as root:

  kubeadm join 192.169.5.180:19999 --token 1tjcje.kmbzlkcm11t854m3 \
    --discovery-token-ca-cert-hash sha256:455202365ffc59f46c7374694adf2477f0e67299f59a2b1c0ba7cf34e869daa5 \
    --control-plane --certificate-key 13da448b92f7d55b5a7963094fe534c110ca93996800761aa04ba046fafbf1a9

Please note that the certificate-key gives access to cluster sensitive data, keep it secret!
As a safeguard, uploaded-certs will be deleted in two hours; If necessary, you can use
"kubeadm init phase upload-certs --upload-certs" to reload certs afterward.

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join 192.169.5.180:19999 --token 1tjcje.kmbzlkcm11t854m3 \
    --discovery-token-ca-cert-hash sha256:455202365ffc59f46c7374694adf2477f0e67299f59a2b1c0ba7cf34e869daa5
 ```
 
 
## /etc/systemd/system/kubelet.service
```
[Unit]
Description=kubelet: The Kubernetes Node Agent
Documentation=http://kubernetes.io/docs/

[Service]
ExecStart=/usr/bin/kubelet
Restart=always
StartLimitInterval=0
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
```
# Note: This dropin only works with kubeadm and kubelet v1.11+
[Service]
Environment="KUBELET_KUBECONFIG_ARGS=--bootstrap-kubeconfig=/etc/kubernetes/bootstrap-kubelet.conf --kubeconfig=/etc/kubernetes/kubelet.conf"
Environment="KUBELET_CONFIG_ARGS=--config=/var/lib/kubelet/config.yaml"
# This is a file that "kubeadm init" and "kubeadm join" generates at runtime, populating the KUBELET_KUBEADM_ARGS variable dynamically
EnvironmentFile=-/var/lib/kubelet/kubeadm-flags.env
# This is a file that the user can use for overrides of the kubelet args as a last resort. Preferably, the user should use
# the .NodeRegistration.KubeletExtraArgs object in the configuration files instead. KUBELET_EXTRA_ARGS should be sourced from this file.
EnvironmentFile=-/etc/default/kubelet
ExecStart=
ExecStart=/usr/bin/kubelet $KUBELET_KUBECONFIG_ARGS $KUBELET_CONFIG_ARGS $KUBELET_KUBEADM_ARGS $KUBELET_EXTRA_ARGS
```

## FAQ1 
```
[shejiyuan@app91 ~]$ kubectl get node
Unable to connect to the server: x509: certificate signed by unknown authority (possibly because of "crypto/rsa: verification error" while trying to verify candidate authority certificate "kubernetes")
```


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
# k8s安装ceph支持

参照 https://docs.ceph.com/docs/master/rbd/rbd-kubernetes/ 这里的说明按顺序执行yml文件

> kubectl apply -f csi-config-map.yaml
> kubectl apply -f csi-rbd-secret.yaml
> kubectl apply -f csi-provisioner-rbac.yaml
> kubectl apply -f csi-nodeplugin-rbac.yaml
> kubectl apply -f csi-rbdplugin-provisioner.yaml
> kubectl apply -f csi-rbdplugin.yaml
> kubectl apply -f csi-rbd-sc.yaml

## test
