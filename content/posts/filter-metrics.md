---
title: "Let's filter Prometheus metrics exposed by Softwares"
date: 2023-10-19T15:41:17+01:00
draft: false
---

This post discusses about the limit of Prometheus crawlers when a software
exposes too much metrics, and provides a solution to limit the number of metrics
exported by Softwares that cannot be modified.

## Sometimes you're just crawling too much

The number of metrics exported on the `/metrics` endpoint of a Software can
impact the performances of Prometheus crawlers. There is at least two ways
crawlers could fail to fetch metrics for a software.

The first case involve a software that is deployed with a small number of Pods,
but exposes a lot of metrics. This is the case of Kube State Metrics for
instance. For each Kubernetes ressource present on the cluster, Kube State
Metrics will expose multiple metrics. On big Kubernetes clusters, the number of
metrics could exceed 1 million metrics. This means that Prometheus crawlers need
to fetch this million of lines every 20 seconds (depends on the interval
configured). With one million lines, the body of the request could exceed 80MB.

Here, the limitation is the time required to receive all the lines. If the
duration of the HTTP request exceed the period between two crawls, the crawlers
timeouts the HTTP request and starts a new one. As a consequence, you may lose
your metrics.

The second case involve a software that exported a reasonable number of metrics,
but is deployed with a lot of Pods. Because the crawler crawl each Pod
individually, each HTTP request finish quickly.

In this second case, the limit could be the CPU allocated to the crawler, or any
intermediate Pod that aggregates the metrics. If prometheus is not able to
process all the metrics quickly enough, you may lose your metrics.

The simple solution would be to throw more CPU at the problem. But let's be
honest, a better solution might be to check if all the metrics exported are
useful. You might save some storage space too!

## Identify metrics that can do not need to be exported

In order to evaluate which metrics can be filtered, you need to:

 1. know all the metrics that are exported by Pods, and the cardinality of each
    metrics;
 2. decide which metrics can be dropped.
 
The easiest way to know which metrics are exported by a Pod is to send a GET
HTTP request to the /metrics endpoint of the Pod. This can be achieved with
`curl` and `kubectl port-forward` if you want to send the request from your
laptop, or with `curl` installed inside a Pod. I will not cover how to use these
tools here.

You can use some shell tools to sort which metrics have the highest cardinality:

```Bash
curl https://ENDPOINT/metrics | grep -v '#' | cut -d'{' -f1 | uniq -c | sort -h
```

Ideally, you want to focus your efforts on high cardinality metrics.

## Reduce the number of metrics exported

There is three possibility know:

1. You can modify the software that exports the metrics to stop exporting
   useless metrics, or to reduce the cardinality of those.
2. You cannot modify the software, but there is a builtin way to stop some
   metrics from being exported.
3. You're out of luck: you cannot either modify the software or modify its
   configuration so that less metrics are exported.

The end of this post will focus on the third option.

If the software is Open Source, you could patch it to remove the metrics.
However, this may come as a cost, because now, you will need to maintain your
patch.

Instead, the solution I'm proposing is to run a HTTP proxy as a SideCar
container that filters metrics exposed by the software. With this solution, you
do not need to rebuild the docker image. You "just" have to modify the Pod
definition.

I implemented a simple HTTP proxy that targets a single HTTP endpoint, and
removes all the lines that match a regular expression. One fear that I had with
this solution was that this introduces some latency, because the proxy need to
run the HTTP request, then serve the response with the lines filtered out. As it
turns out, most of the HTTP time used to serve the HTTP request comes from the
network, so as long as the proxy removes enough lines in the body response, a
HTTP request to `/metrics` could be instead **faster**.

The tool is called [metrics-filter](https://github.com/polyedre/metrics-filter).
