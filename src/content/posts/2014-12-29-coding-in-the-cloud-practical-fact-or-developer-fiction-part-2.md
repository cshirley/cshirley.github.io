---
layout: post
title: Coding In the Cloud [practical fact or developer fiction] part 2
description: "Six weeks of trying to code from an iPhone 6 Plus with a monitor and Bluetooth keyboard: what worked, where the device fell short, and why I moved on to a cellular iPad Air 2."
date: 2014-12-29 20:29:40.000000000 +00:00
type: post
published: true
status: publish
categories:
- Development
tags:
- Cloud
- mosh
- ovh
- tmux
- vim
- vps
meta:
  _edit_last: '22041244'
author:
  email: clive@shirleyconsulting.co.uk
  display_name: Clive Shirley
---

*Written in 2014 while I was experimenting with doing my day-to-day development away from a laptop. Kept here as originally published.*

In [part 1](/development/2014/10/04/coding-in-the-cloud-practical-fact-or-developer-fiction.html) I moved my development environment to a VPS. This follow-up covers the next step: leaving the laptop behind, first with an iPhone 6 Plus and then with a cellular iPad Air 2, and the kit I ended up with.

## The iPhone 6 Plus experiment

An [iPhone 6 Plus](http://www.apple.com/iphone-6/) in my back pocket means I can be productive any place there is a cell connection (in theory). Coding in the cloud via a MacBook Air for a good few months before this experiment gave me the confidence that, given access to an SSH client, I could code from any platform.

The iPhone 6 Plus is an excellent device when paired with an HD monitor and Bluetooth keyboard. I used a [Filco MINILA Air](http://www.keyboardco.com/keyboard/uk-majestouch-minila-air-68-key-tactile-action-bluetooth-keyboard.asp) at my desk and, more recently, a [Logitech Keys-To-Go](http://www.logitech.com/en-gb/product/keys-to-go-ipad) when out of the office. The setup gave me a truly task-oriented approach to my day job while carrying relatively little kit.

When on site, the same setup works provided a monitor is available. Otherwise working from the iPhone's screen proves tiresome for anything but the simplest tasks, such as emergency bug fixes and deployments. At one point I considered trying [Google's Cardboard VR](https://www.google.com/get/cardboard/) headset adapter for smartphones, but decided against it (purely for cosmetic reasons).

## What worked and what didn't

It is safe to say the general premise works for this 43-year-old engineer, and it resonates with the younger members of the engineering teams I work with (it certainly has a "cool" factor). Productivity for coding work was the same as from my MBA, at least when in the office.

I did find limitations with some of the tools used for build specifications and design documents, which still required my MBA. Word on the iPhone is not really useful for anything other than reading and minor edits.

After a mixed six weeks of coding from the iPhone, it is clear the device, while capable, is not suitable for true nomad-style development. It works along the lines of the [TangoPC](http://www.tangopc.com): a device that needs some kind of docking station at each site you work from. The big bonus is switching seamlessly from WiFi to 4G when on the move, although I am still waiting for Mosh support from one of the SSH apps to make that truly seamless.

The pattern is clear. The phone is fine for short, well-defined jobs: an emergency bug fix, a deployment, checking on something running on the VPS. It falls down as soon as the work needs a bigger screen or a document editor. Typing code was never the problem, because the code lives on the VPS in vim and tmux. The weak points are the screen, the keyboard and the tools around the code.

## Moving to the iPad Air 2

While I have not ditched the iPhone completely, I have moved on to an iPad Air 2 with 4G/LTE. Same tools, better screen when working from a coffee shop or on the train. A bigger screen helps with exactly the things the phone struggled with, while the rest of the setup stays the same: SSH into the VPS, tmux for the session, vim for the editing. Nothing about the environment had to change, only the glass I look at it through.

My new setup is:

### Hardware

- iPad Air 2 4G/LTE
- [Twelve South Surface Pad](https://twelvesouth.com/product/surfacepad-for-ipad)
- [Logitech Keys-To-Go](http://www.logitech.com/en-gb/product/keys-to-go-ipad)
- Three mobile 10 GB/month plan with international roaming
- Apple HDMI lightning connector
- [MU tablet USB adapter](http://www.themu.co.uk/pages/mu-tablet)

### Software

- [OVH Classic VPS](https://www.ovh.co.uk/vps/vps-classic.xml): the development environment from part 1, where all the code and tooling live
- iOS 8.1
- WebSSH: the SSH client, chosen for its excellent 256 colour support in vim and tmux
- Dropbox: still the safety net syncing files between the VPS and my MBA
- Word: fine for reading and minor edits, little more
- OmniGraffle
- OmniPlan
- Skype
- MIHTool
- GitHub
- Dash
- Flipboard
- Safari

## What happened next

This setup was the start of a long habit, not a one-off experiment. By 2022 I was relying on an iPad Pro for about 95% of my day job, using the blink.sh terminal emulator to SSH into my MacBook, so the iPad was really just a screen. That is written up in [How I Get Through a Day at Babylon](/development/2022/02/14/how-i-get-through-a-day-at-babylon.html).

The Mosh gap I was waiting on here is long gone. In [How I Work Today](/development/2026/09/30/how-i-work-today.html) I attach to the same tmux session from my desk, an iPad or an iPhone using Blink, mosh and Tailscale, and a single `install.sh` builds the same environment on a Mac or a VPS. The plan in part 1 to automate VPS setup turned into that dotfiles repository.

## The general lesson

A thin client and a persistent remote session beat carrying the machine around. Once the work lives in a long-running session on a server, the device in your hands is only a screen and a keyboard, and the real constraints become display size, input and the non-terminal tools you still depend on. Find those weak points early, because they decide which device is worth carrying, not how well it runs your editor.

## Related

[Coding in the Cloud [practical fact or developer fiction]](/development/2014/10/04/coding-in-the-cloud-practical-fact-or-developer-fiction.html) is the previous instalment on this topic.
