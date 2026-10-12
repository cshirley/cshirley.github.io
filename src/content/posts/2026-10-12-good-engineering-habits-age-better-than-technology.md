---
title: "Good Engineering Habits Age Better Than Technology: Rereading My Final-Year Project"
description: "Rereading my final-year project from the mid-1990s, I was struck by how little the core lessons have changed. The stack is obsolete, but the habits still look right: understand users, iterate, separate concerns, write things down, and design for change."
date: 2026-10-12 09:00:00 +0100
draft: false
categories:
- Development
tags:
- architecture
- decision making
- specifications
author:
  display_name: Clive Shirley
---

I recently dug out my final-year project from the mid-1990s. It was a long academic write-up for a support diary booking system I built during an industrial placement: Windows 3.11, Visual Basic 3, Access 2, Novell, the lot. Parts of it are wonderfully dated. Some of it is over-written in the way student work often is. Some of it is trying very hard to sound like someone who has read a lot of methodology books and would like you to know it.

But rereading it was still worth doing, because beneath the period detail I could see the shape of the engineer I was about to become. **The technology has aged out completely. The instincts have not.**

<figure>
  <img src="/assets/final-year-project-system-architecture-1995.png" alt="System architecture diagram from my final-year project, showing accounting, document management and proposed diary system components across Windows, Unix and Novell-era infrastructure" loading="lazy" />
  <figcaption>The original system architecture diagram. The stack is dated. The integration concerns are not.</figcaption>
</figure>

## The tools changed, the concerns did not

The project was about building a multi-user booking system for a live business. That meant competing concerns from the start: users needed it to be easy to operate, the business needed it to fit messy real workflows, and the implementation needed to survive future change. Those are still the same pressures behind most worthwhile software.

What changed was the vocabulary. Back then I wrote about structured methods, data flow diagrams, module specifications and HCI. Today I would talk about domain modelling, contracts, bounded contexts, adapters, delivery risk and operability. The names moved. The underlying worries did not.

I was concerned with maintainability, coupling, future integration, interface consistency, and requirements being lost between analysis and implementation. None of that reads obsolete. If anything, it reads familiar.

The funny part is the stack choices. At the time, Visual Basic looked like a practical route to a usable Windows interface, and Access looked like a convenient implementation detail that could later be replaced by a larger relational database. The specific choices are museum pieces now, but the reasoning still feels sound: choose tools that let you ship in context, and keep enough separation that you can replace part of the solution later.

## Younger me already distrusted pure waterfall

One line stood out on the reread: the document says the project did not really proceed in a neat sequence, and that significant iteration was required between research, design and implementation. That was a polite academic way of saying reality ignored the plan.

> "Significant iteration between the stages outlined was required... there was considerable iteration between research, strategy development and its implementation."

That still happens. We still produce linear diagrams for work that is discovered through feedback. We still want the certainty of a requirements phase that ends cleanly before design begins. We still find out, halfway through building, that a user means something slightly different by a term than we assumed, or that the easy workflow is not the common one.

Even then I had already learned that **interactive systems have to be tested through interaction**. You cannot reason your way all the way to usability from first principles. At some point you need to show something to users, watch where they hesitate, and change it.

> "Requirements for a HCI system cannot be specified at the beginning of the life cycle. The only way we can be sure about such systems is to build and then evaluate them."

That lesson has only become more important. Modern teams have better tools for prototyping, telemetry, feature flags and experimentation, but the core truth is the same: if the system is for humans, you learn by watching humans use it.

## The part I am happiest to see is the emphasis on writing

The most encouraging thing in the old project is not the technology choice or the diagrams. It is the insistence on writing things down.

I cared about cross-referencing requirements to design. I cared about module specifications. I cared about version control for documents and code. I cared about making the reasoning visible enough that someone else could follow it later.

> "Version control for all documentation including program code will be implemented and maintained... All document amendments and updates will be tracked..."

That instinct has stayed with me all the way through architecture work. Design docs, RFCs, ADRs, verification reports, migration runbooks, operational checklists: these are not management theatre. They are how you make technical reasoning reviewable. They are how a system stays legible after the meeting ends and after the people involved have moved on.

The older I get, the less I believe in heroics and the more I believe in artefacts that survive their authors. A good design document is not bureaucracy. It is a way of leaving behind a falsifiable argument.

## Some of it was still naivety

Not everything in the project aged well.

There is a very student-like faith that enough method can tame ambiguity. I was clearly looking for the right combination of models and techniques that would make the path from problem to system feel rigorous and complete. Real projects are less tidy than that. Ambiguity is not a temporary defect in the process. It is part of the material.

I also gave formal structure a little too much credit, and experience and judgement a little too little. The document eventually notices this itself, especially when it admits that intuition still dominates much of design. That was the beginning of a better understanding. Methods help. They prompt questions, expose gaps and give teams shared language. But they do not remove the need for taste.

And, of course, there is the classic early-career optimism that a clean separation between logical design, program structure and interface work can be maintained more neatly than life usually allows. Separation of concerns is still right as an aim. It is just never as clean in practice as it is on paper.

## What stayed with me

If I draw a straight line from that project to the work I value now, it is this:

- start from how people actually work
- write down the important decisions
- separate concerns where you can
- expect iteration rather than pretending to avoid it
- design for maintenance, not only initial delivery
- choose tools for the context you are in, not for abstract purity

That is a decent summary of how I still like to build software.

I also smiled at one other thread in the document: the concern for the user interface as something that should be consistent, constrained and honest about system state. I would now phrase that as reducing cognitive load and making invalid actions hard to perform, but it is the same basic idea. Good software does not merely expose capability. It guides behaviour.

<figure>
  <img src="/assets/final-year-project-ui-prototype-1995.png" alt="Screenshot from my final-year support diary system prototype, showing a Windows-era multi-user booking interface with diary slots, consultants and booking details" loading="lazy" />
  <figcaption>A surviving interface screenshot from the prototype. Even here, the concerns were consistency, visibility of state, and keeping the common workflow obvious.</figcaption>
</figure>

## The general lesson

**Good engineering habits outlast platforms, languages and frameworks.** A stack can become a historical curiosity, but clear thinking about users, change, interfaces, coupling and evidence tends to remain useful. That is one reason I like rereading old work. Not because it proves I was right, but because it shows which instincts were worth keeping long after the tools disappeared.
