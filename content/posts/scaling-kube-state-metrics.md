---
title: "Reduce Kube State Metrics's sample count by 45%"
date: 2023-05-31T19:41:17+01:00
draft: false
---

[Kube State Metrics](https://github.com/kubernetes/kube-state-metrics) is a
service that listen to the Kubernetes API server and generates metrics about the
state of the resources (Pods, Deployments, Namespaces...).
The metrics are exported on the HTTP endpoint `/metrics` on the listening port
(default 8080). They are served as plaintext and can be crawled directly by
Prometheus.

For each Kubernetes resource, some metrics are available. For Pods for
instance, the metrics listed in [this
file](https://github.com/kubernetes/kube-state-metrics/blob/main/docs/pod-metrics.md)
are available. This includes `kube_pod_info` and `kube_pod_status_phase`.

Each line represent a metric in the output of a request to the HTTP endpoint.
The more Kubernetes resources there are, the more metrics there are, and the
larger the endpoint crawl result. With big Kubernetes clusters, the HTTP
endpoint can return about one million lines of metrics.

This is a problem because Prometheus needs to crawl the endpoint regularly, and
20 seconds is a good frequency. But when the endpoint is too large, the HTTP
request can take many seconds. Before the time needed to crawl the endpoint
exceeds 20 seconds, it's time to clean up the metrics exported by Kube State
Metrics.

Fortunately, Kube State Metrics lets you limit the number of metrics exported in two different ways.

## Choose the Kubernetes resource to export

Kube State Metrics allows you to enable or disable the export of metrics
associated with each Kubernetes resource type. This is configured in the Helm
chart with the `collectors` variable:

```yaml
collectors:
  - certificatesigningrequests
  - configmaps
  - cronjobs
  - daemonsets
  - deployments
  - endpoints
  - horizontalpodautoscalers
  - ingresses
  - jobs
  - leases
  - pods
[skipped]
```

This is by far the easiest way to reduce the number of metrics.

## Block useless metrics from being exported

But what if I'm not interested in `kube_pod_info` but use
`kube_pod_status_phase` ? It is not possible to disable the collector for the
Pods because otherwise `kube_pod_status_phase` would not be exported.

To manage metrics individually, Kube State Metrics allows to block some metrics
explicitely. This is configurable in the Helm Chart with the `metricDenylist` variable:

```yaml
metricDenyList:
  - kube_*_info
  - kube_pod_status_qos_class
```

## Identifying unused metrics

Identifying the unused metrics is the boring part of the process. The ideal
would be to extract the list of all metrics used by the Grafana Dashboards. In
practice, it depends of the organization.

On the clusters I worked with, I was able to identify about half of the metrics
as useless. After rolling out the Helm Chart with the new values, the CPU and
memory usage dropped by about 20% and the size of the HTTP response has been
reduced by about 45%.

The time to crawl the HTTP endpoint became far more manageable. The users can
continue to deploy new Kubernetes resources without worries.

## An alternative to reduce the size of a crawl

There is an other approach to reduce the size of a crawl and avoid the 20
seconds limit. Kube State Metrics can scale horizontally by sharding the metrics
between the different Pods.

When the sharding is enabled in the Helm Chart, the Deployment is replaced by a
StatefulSet, and the Service by a Headless Service. Each pod is started with the
two flags `--shard <id>` and `--total-shards <count>`.

This approach could have been an option if removing a lot of unused metrics from
the export would not have been possible.
