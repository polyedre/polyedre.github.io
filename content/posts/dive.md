---
title: "Identifying unused files in Docker images with Dive"
date: 2022-12-10T12:57:17+01:00
draft: false
---

One of the challenges of using Docker is that images can often be quite large, especially for interpreted languages. Large Docker images increase pull time and disk space usage, making it difficult to manage and deploy applications. In this article, we'll take a look at a tool called "dive" that can help to optimize the size of Docker images.

Dive is a command-line tool that allows users to analyze the addition of each layer to the filesystem of a Docker image. This information can be used to identify unused or unnecessary files, which can then be removed to reduce the size of the image. Let's take a look at how I used dive to optimize the size of the Docker image for the open-source web scanner Wapiti.

## Using Dive

To use dive, you'll need to install it on your system. On Debian or Ubuntu, you can do this with the following command:

```sh
wget https://github.com/wagoodman/dive/releases/download/v0.9.2/dive_0.9.2_linux_amd64.deb
sudo apt install ./dive_0.9.2_linux_amd64.deb
```

Once dive is installed, you can use it to analyze a Docker image by running the following command, where IMAGE_NAME is the name of the image you want to analyze:

```sh
dive IMAGE_NAME
```

This will launch the dive interface, which will show you a list of all the layers in the Docker image and the size of each layer. Dive is a text user interface (TUI) tool, so you can navigate the filesystem using the keyboard shortcuts at the bottom of the terminal.

## Analyzing Wapiti with Dive

Wapiti is a popular open-source web scanner that is used to identify vulnerabilities and security flaws in web applications. It is written in Python and uses a blackbox approach to testing, which means that it does not rely on the source code of the application being tested.

Instead, Wapiti works by crawling the application and sending requests to the various URLs that it discovers. It then analyzes the responses from the application and looks for potential vulnerabilities, such as cross-site scripting (XSS) and SQL injection attacks.

Recently, Wapiti added support for scanning single page websites. To do this, Wapiti needs to interpret JavaScript code and rely on Firefox headless. The Docker image for this version of Wapiti is quite large, as shown in the following example:

```sh
$ docker image ls cyberwatch/wapiti-headless:latest
REPOSITORY                   TAG       IMAGE ID       CREATED          SIZE
cyberwatch/wapiti-headless   latest    815ece1118d6   3 days ago       682MB
```

To analyze this image with dive, we can use the following command:

```sh
dive cyberwatch/wapiti-headless:latest
```

When browsing the layers, I noticed that two archives that were downloaded to install Firefox and Gecko Driver were still present in the final image.

![!Dive interface showing that two archives takes 81MB!](wapiti-headless-useless-archives.png)

After removing these archives, the size of the Docker image was greatly reduced:

```sh
$ docker image ls cyberwatch/wapiti-headless:latest
REPOSITORY                   TAG       IMAGE ID       CREATED         SIZE
cyberwatch/wapiti-headless   latest    e642ae5ff5a7   4 minutes ago   582MB
```

I submitted a [pull request](https://github.com/wapiti-scanner/wapiti/pull/342) with the fix.

## Conclusion

In conclusion, the dive tool is a powerful and easy-to-use tool for optimizing
and reducing the size of Docker images. By using the techniques discussed in
this article, you can make your Docker images smaller and more efficient, which
will make it easier to manage and deploy your containerized applications.
