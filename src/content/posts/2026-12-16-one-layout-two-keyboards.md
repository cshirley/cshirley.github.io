---
title: "One Layout, Two Keyboards: Keeping a Keymap Reproducible"
description: "How I keep one keyboard layout working on a wired Planck and a travelling Geonix, with different firmware, and why the recovery notes matter as much as the keymap."
date: 2026-12-16 09:00:00 +0000
categories:
- Development
tags:
- keyboards
- tooling
- productivity
- developer experience
author:
  display_name: Clive Shirley
---

I use two keyboards. A [Planck](https://olkb.com/collections/planck) (revision 7, whose [QMK firmware](https://github.com/qmk/qmk_firmware/tree/master/keyboards/planck/rev7) is open source) sits wired on the desk in my home office. A [Geonix 2.5](https://chosfox.com/products/chosfox-x-masro-geonix-rev-2-5) travels with me, including on the roughly fortnightly trip to my employer's office. Both are small ortholinear boards, one wired and one wireless, and both run a layout I have tuned over time.

The trouble is that I rebuild these layouts rarely, and each board has its own firmware and its own way of flashing it. I am also getting older, and I no longer trust my memory to hold a procedure I follow once or twice a year. So I wrote it all down.

This post covers how the two keyboards share one layout, and why the notes that go with it matter as much as the keymap.

**How do you keep one layout working on two boards with different toolchains?**

<div class="image-pair">
  <figure>
    <img src="/assets/keyboards-planck-v7.jpeg" alt="The Planck v7, a 4x12 ortholinear keyboard, wired on my home office desk" loading="lazy" />
    <figcaption>Planck v7: USB only, on the desk</figcaption>
  </figure>
  <figure>
    <img src="/assets/keyboards-geonix-2-5.jpeg" alt="The Geonix 2.5, a compact ortholinear keyboard that connects over USB, Bluetooth or 2.4 GHz wireless" loading="lazy" />
    <figcaption>Geonix 2.5: USB, Bluetooth or 2.4 GHz, for travel</figcaption>
  </figure>
</div>

## Why an ortho board

An ortholinear keyboard lays its keys out in a straight grid instead of staggering the rows. The Planck is a 4x12 grid with no number row, no function row and no dedicated arrow cluster. I had never come across one until about three years ago. It is small, portable and unusual, and those three things were enough to make me try one.

The usual argument for the grid is about finger movement. A staggered layout dates from the mechanical typewriter, where the offset between rows made room for the linkages. Keys no longer need that offset, so they can sit in vertical columns, which [reduces lateral finger movement between rows](https://en.wikipedia.org/wiki/Ergonomic_keyboard#Vertical_column_layout). The same source notes the trade-off: the distance from the neutral finger position to some secondary keys grows, and a keyboard with vertical columns can need an adjustment period while you retrain your fingers.

The grid helps in two other ways that matter to me:

- **Predictable positions:** every key sits directly above or below its neighbour, so a key's position on a layer is easy to reason about and to describe in a config file.
- **A small footprint that still works:** with only 48 keys, the rest of the keyboard has to live on layers, and QMK handles that with [layers](https://docs.qmk.fm/feature_layers) and [mod-tap keys](https://docs.qmk.fm/mod_tap), which give one key a tap action and a hold action.

I am not aware of a rigorous study showing that ortholinear boards make people faster or reduce strain. Treat the movement argument as a plausible reason to try one, not as proof, and expect the adjustment period to be real. The Wikipedia article is a summary rather than a primary source.

The hard part was switching layers to reach numbers and symbols, with those characters missing from the keycaps, so I had to learn them without looking.

## One layout, two boards

The two boards now share the same layout and format, so my hands keep the same habits wherever I sit. What they share is the part that matters most:

- **The alpha layer:** plain QWERTY.
- **Tap and hold on one key:** a tap gives Escape, a hold gives Control.
- **Numbers and special characters:** on lower and raise layers, reached from the thumb keys.
- **Navigation:** arrow keys on the bottom right, with Home, End, Page Up and Page Down on the layers.
- **Media controls:** next, volume and play on the layers.

The Control and Escape key is the one I would miss most. In QMK it is a single keycode, and in VIA it is a mod-tap:

```c
LCTL_T(KC_ESC)        // QMK Configurator (Planck)
MT(MOD_LCTL, KC_ESC)  // VIA (Geonix)
```

The Geonix does not match the Planck key for key. Its layer numbering differs, and it has an extra layer for lighting and for switching between devices and connection types. The base layer, the thumb-key habit and the Control and Escape key are the same, and that is what gives me continuity.

I also tried Colemak and Dvorak-style layouts. That experiment failed, and the layers are still in the Planck file. After so many years of QWERTY, learning a new alpha layout while also learning layers was too much to take on at once.

## Agnostic to the computer

The layout lives in the keyboard's firmware, not in the operating system. Nothing is installed on the computer I am using. The remapping happens on the board before a keystroke leaves it, so the host only sees an ordinary keyboard.

That makes me independent of the computer. I plug in the keyboard and go. Escape and Control sit where my fingers expect them, and the numbers, symbols and navigation are on the same layers. The Planck v7 is USB only, so it stays wired on the desk. The Geonix 2.5 connects over USB, Bluetooth or a 2.4 GHz wireless receiver, and its extra layer switches between those connections and the devices paired to them. One board can follow me across the machines I use in a day without a cable.

The sources of truth are the keymap file and the notes, not any one computer's settings. If a machine is replaced, or I am handed a loan laptop at the office, my keyboard setup does not change.

## Two firmwares, two toolchains

The boards run different firmware, so each has its own recipe.

| | Planck | Geonix 2.5 |
|---|---|---|
| Firmware | QMK | VIA (Vial) |
| Configure | QMK Configurator, upload the layout JSON, build | VIA app, load the base definition, then the saved layout |
| Flash | QMK Toolbox | Copy the base `FLASH.bin` to the mounted USB drive |
| Enter DFU mode | Hold both shift keys and press B | Hold Tab while plugging in the cable |

If the Geonix load fails, the recovery is to reflash the base firmware and configure again. I have needed this in practice, on the 2.0 version of the board. The 2.5 has been more reliable.

## Keeping it in version control

The layout JSON files, the base definition and a README of the steps live together in my notes repository. The configs are dated, so the history shows how the layout changed.

The README is the part I would have been sorry to lose. A layout file tells me what the keyboard should do. It does not tell me how to get it back on the device, or how to enter DFU mode when the keyboard will not talk to the app.

## Things to get right

- **Keep the base layer identical** across boards. Differences in the extra layers are cheap. Differences in the base layer cost typing time.
- **Write the DFU steps next to the config.** You need them exactly when the keyboard is not working.
- **Date your exports** so you can go back to a known good layout.
- **Test the recovery path before you travel,** not in a hotel room.

## The general lesson

Anything you depend on every day and rebuild only rarely needs its recovery steps stored with its configuration. **A config file says what you want; a runbook says how to get it back.** I write runbooks for production systems for the same reason I now keep one for my keyboard.
