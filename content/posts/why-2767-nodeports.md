---
title: "Why Kubernetes NodePort Stops at 32767?"
date: 2024-09-25T14:41:17+01:00
draft: false
---

In Kubernetes, NodePort allows external traffic to access services via a
specific port range, typically 30000-32767. But while starting at port 30000
makes sense because Kubernetes does not want to conflict with other ports of the
host, I wondered why Kubernetes supports only 2767 NodePorts by default.

After digging a little bit, I found that the value 32767 represents the maximum
for a 15-bit unsigned integer. Limiting the range to 32767 was therefore chosen
to ensure the compatibility with systems that may treat ports as signed
integers. This prevents potential issues in networking software.

Kubernetes offers flexibility in adjusting the NodePort range. Administrators
can modify the `service-node-port-range` flag to expand the range if needed.
However, expanding the range requires careful network configuration, including
updating firewall rules to allow traffic through additional ports however, be
careful!
