---
permalink: /blog/
layout: page
title: "Posts"
subtitle: ""
---
<section id="main" class="container {{ page.box_width }}">
  <div class="row">
    <div class="12u">
      <!-- Text -->
      <section class="box">
        {% for post in site.posts %}
            <div class="row">
              <div class="12u">
                <span class="post-meta">
                  {{ post.date | date: "%b %-d, %Y" }}
                </span>
                <h3>
                  <a class="post-link"
                    href="{{ post.url | prepend: site.baseurl }}">
                    {{ post.title }}
                  </a>
                </h3>
               </div>
            </div>
        {% endfor %}
      </section>
    </div>
  </div>
  <div class="row">
    <div class="12u">
      <!-- Text -->
      <section class="box">
        <p class="rss-subscribe">
        subscribe <a href="{{ "/feed.xml" | prepend: site.baseurl }}">
                  via RSS
                  </a>
        </p>
      </section>
    </div>
  </div>

</section>
