---
layout: post
title: URI Rules the World
description: "Why the links inside social posts turned out to be rich signals: expanding shortened URIs, who shared them and when, and how that fed junk filtering, relevance and authority models for financial content."
date: 2013-02-25 09:46:44.000000000 +00:00
type: post
published: true
status: publish
categories:
- FSWire

tags: []
meta:
  _edit_last: '22041244'
author:
  email: clive@shirleyconsulting.co.uk
  display_name: Clive Shirley
---

*Part of my FSWire series, written in 2013 while I was building a social-data analytics platform for financial markets. Kept here as originally published.*

Over the past few months we have been investigating the multiple dimensions of URIs (links) embedded within social content, to determine whether (or not) they play a (significant) role in analysing social content.

On the face of it a URL looks pretty innocuous, yet it has many hidden dimensions such as the person who posted/re-tweeted it, which could lend insight into how that individual interacts with various social and business domains. For example the time stamp of the content which included said URL provides an indication of when a user discovered a particular piece of information. If we can relate this back to the original content's release date/time we have a measure which we can leverage (we coin this as the: *'reaction/response to information'*). Based on frequency of posts containing the URL over particular periods of time we can determine how quickly certain information is being disseminated through social networks and how relevant it is.

[![Authoritative User](/assets/db-message-auth-user.png)](/assets/db-message-auth-user.png)

Social Messages with Authoritative User post

URIs tend to be shortened so expanding them is a must (as the same URL may be encoded differently); this process yields more dimensions that are not accessible through a single URL shortening service's API. Thus we end up with a set of data which, when augmented with that of the respective URL shortening services, creates more statistical measures providing us with keen insight.

So how has this information helped us? Broadly - categorisation, with respect to our junk filtering and relevance engines for associating content with sectors/companies.

Furthermore data disseminated through social media is trended before being indexed by classical content crawlers (i.e. search engines). This can lead to an edge in delivery of said information to our customers.

Another key advantage has been in our user authority/relevance models improving our perception of authoritative figures within a particular sector/community (i.e. by looking at how quickly they recognise and re-publish relevant information).

### Product Enhancements

The results of this research can be seen in multiple areas of our most recent product update (live now) which we are really excited about and we hope you love it as much as we do ! Here are just a couple of them:

[![Social Analytics](/assets/db-messages-social.png)](/assets/db-messages-social.png)

Social v Price over the last 7 days with real-time social data in lower chart

[![Message Links](/assets/db-links.png)](/assets/db-links.png)

Top links driving the social market

← New feature which expands, sanitises and displays the relevant URIs for a particular sector/company using our own proprietary ranking algorithm

Our customers will see an improved correlation between price and our social indicator, in many instances predicting price direction 24-48 hours prior to financial market reaction (price:black, social:green). The key is knowing when to listen or more importantly when not to! (Which is available as a paid upgrade)→

Why not pop-over and take a look at fswire is no longer available

