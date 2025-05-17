---
title: "Deploy and Manage a Guix VM in OpenStack"
date: 2025-05-17T12:42:19+02:00
draft: false
---

It's been a few months since I started using Guix as the Operating System of my personal laptop. I'm found of how easy
it is to enable some services or install packages. Now that I've become more familiar with Guile as a programming
language, I took some time to deploy a Virtual Machine in OpenStack (through the Public Cloud offering of OVHcloud), and
used `guix deploy` to manage this VM. This post summarize my experience doing so.

# Building the QCow2 image locally

Creating a QCow2 image with Guix was so easy I was sure the VM would not boot the first time (there's not way right?). I
can even claim that it is as easy as writing a Dockerfile to create a OCI container.

The first step was to define an
[operating-system](https://guix.gnu.org/manual/en/html_node/operating_002dsystem-Reference.html). I tweaked some example
I found online, and got this:

#### **image.scm**

```scheme
(use-modules (gnu)
             (nongnu packages linux)
             (guix packages)
             (guix build-system copy))

(use-service-modules networking ssh web)
(use-package-modules bootloaders ssh web version-control)

(operating-system
  (kernel linux)
  (firmware (list linux-firmware))
  (host-name "guix-1")
  (locale "en_US.utf8")
  (timezone "Europe/Paris")
  (keyboard-layout (keyboard-layout "fr"))

  (bootloader (bootloader-configuration
               (bootloader grub-bootloader)
               (target "/dev/vda")
               (terminal-outputs '(console))))
  (file-systems (cons (file-system
                        (mount-point "/")
                        (device "/dev/vda1")
                        (type "ext4"))
                      %base-file-systems))
  (services
   (append
    (list
     (service dhcp-client-service-type)
     (service openssh-service-type
              (openssh-configuration
               (openssh openssh-sans-x)
               (permit-root-login #t)
               (authorized-keys
                ;; Authorise our SSH key.
                `(("root" ,(local-file "/home/polyedre/.ssh/id_rsa.pub"))
                  ("polyedre" ,(local-file "/home/polyedre/.ssh/id_rsa.pub")))))))
    (modify-services %base-services
      (guix-service-type config =>
                         (guix-configuration
                          (inherit config)
                          (authorized-keys (append (list (local-file "/etc/guix/signing-key.pub")) %default-authorized-guix-keys))))))))
```

This file declares an operating system that uses the Linux Kernel and additionnal non-free firmware drivers, and enable
two important services:

 - a DHCP client to get the IP automatically
 - an OpenSSH daemon that authorize connection to the root user with the public key read from my local laptop.

With this, you are one simple command away from building your image:

```bash
guix system image --root=guix-result --image-type=qcow2 image.scm
```

The flag `--root` ask guix to create a symlink named `guix-result` that point to the artifact that will be built.

Because `guix-result` is a read-only artifact, to boot the machine locally for testing purpose you will have to copy the
file to a writable folder:

```bash
cp guix-result guix.qcow2
```

You can start the virtual machine using qemu:

```
guix shell qemu -- sudo qemu-system-x86_64 -nic user,model=virtio-net-pci -enable-kvm -m 2048 -device virtio-blk,drive=guix-demo -drive if=none,file=guix.qcow2,id=guix-demo
```

# Uploading the Qcow2 image and starting a VM from it

In this section, I will assume some basic knowledge of how to use OpenStack. To install OpenStack's CLI, just use pip:

```bash
pip install python-openstackclient
```

You will then be able to upload the image:

```bash
openstack image create \
          --progress \
          --disk-format qcow2 \
          --container-format bare \
          --file guix-result \
          --property hypervisor_type=kvm \
          --property os_type=linux \
          --property os_admin_user=root \
          --property os_distro=guixsystem \
          --property os_version=unknown \
          guix
```

And start the VM. The OVHcloud OpenStack installation provides public IPs using the `Ext-Net` subnet. I'll start a VM
named `guix-1` with 8 Go of memory:

```bash
openstack server create \
          --image guix \
          --network Ext-Net \
          --flavor b3-8 \
          --key-name laptop \
          guix-1
```

After a minute or two, the VM is ready and I can connect to it with SSH:

```bash
$ openstack server list
+--------------------------------------+--------+--------+--------------------------------------------------+-------+--------+
| ID                                   | Name   | Status | Networks                                         | Image | Flavor |
+--------------------------------------+--------+--------+--------------------------------------------------+-------+--------+
| af308c4e-8064-44c3-8ced-ed7c112478eb | guix-1 | ACTIVE | Ext-Net=2001:41d0:304:300::627d, 217.182.210.193 | guix  | b3-8   |
+--------------------------------------+--------+--------+--------------------------------------------------+-------+--------+
$ ssh root@217.182.210.193
Last login: Fri May 16 17:50:33 2025 from 81.65.157.5
root@guix-1 ~# 
```

The image we built does not include `cloud-init`. So you will have to resize the partition manually before running `resize2fs`!

# Manage the VM remotely using `guix deploy`

Starting a VM from an image that we just built was great, but what about day-2 management of the VM? We had a
declarative configuration to build the image. Can we have the same to manage our remote VM? How to add users, packages
or services?

Let's see!

To use `guix deploy`, we need a file that list all the machines that are managed with their configuration. Let's reuse
our `operating-system` resource written in `image.scm`.

#### **deploy.scm**

```scheme
(use-service-modules networking ssh)
(use-package-modules bootloaders ssh)

(define os (load "image.scm"))

(list (machine
       (operating-system os)
       (environment managed-host-environment-type)
       (configuration (machine-ssh-configuration
                       (host-name "217.182.210.193")
                       (system "x86_64-linux")
                       (user "root")
                       (host-key #f)
                       (port 22)))))
```

This file define a single machine managed through SSH.

To apply the configuration to the remote machine, you are just a `deploy` away!

```bash
guix deploy deploy.scm
```

By default, Guix will build all the artifacts locally, and then send them to the server.

You can now add users, packages or services and deploy again:

```diff
(use-modules (gnu)
             (nongnu packages linux)
             (guix packages)
             (guix build-system copy))

(use-service-modules networking ssh web)
(use-package-modules bootloaders ssh web version-control)

(operating-system
  (kernel linux)
  (firmware (list linux-firmware))
  (host-name "guix-1")
  (locale "en_US.utf8")
  (timezone "Europe/Paris")
  (keyboard-layout (keyboard-layout "fr"))

+  (users (cons* (user-account
+                 (name "polyedre")
+                 (comment "Polyedre")
+                 (group "users")
+                 (home-directory (string-append "/home/" "polyedre"))
+                 (supplementary-groups '("wheel" "netdev" "audio" "video")))
+                %base-user-accounts))

+  (packages (cons* git
+                   %base-packages))

  (bootloader (bootloader-configuration
               (bootloader grub-bootloader)
               (target "/dev/vda")
               (terminal-outputs '(console))))
  (file-systems (cons (file-system
                        (mount-point "/")
                        (device "/dev/vda1")
                        (type "ext4"))
                      %base-file-systems))
  (services
   (append
    (list
     (service dhcp-client-service-type)
     (service openssh-service-type
              (openssh-configuration
               (openssh openssh-sans-x)
               (permit-root-login #t)
               (authorized-keys
                ;; Authorise our SSH key.
                `(("root" ,(local-file "/home/polyedre/.ssh/id_rsa.pub"))
                  ("polyedre" ,(local-file "/home/polyedre/.ssh/id_rsa.pub"))))))
+    (service nginx-service-type
+             (nginx-configuration
+              (server-blocks
+               (list
+                (nginx-server-configuration
+                 (listen '("8080"))
+                 (server-name '("www.polyed.re"))
+                 (root (file-union "nginx-root"
+                                   `(("index.html" ,(local-file "./index.html")))))))))))
    (modify-services %base-services
      (guix-service-type config =>
                         (guix-configuration
                          (inherit config)
                          (authorized-keys (append (list (local-file "/etc/guix/signing-key.pub")) %default-authorized-guix-keys))))))))
```
