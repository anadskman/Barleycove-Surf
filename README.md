# Barleycove Surf

Barleycove Surf is a surf forecast website I made for Barleycove Beach in West Cork.

I normally use Surfline to check the surf, but I found that the forecast for Barleycove was not always very accurate. I wanted to make something that was more focused on the actual beach and the conditions that matter there.

The website takes swell, wind and tide information and uses it to give the current conditions and a surf rating. It also has a map showing the swell direction and a section where people can add their own reports from the beach.

## What it does

* Shows the current surf conditions
* Shows swell height, period and direction
* Shows wind speed and direction
* Shows tide height and whether it is rising or falling
* Shows sea temperature when available
* Gives the conditions a surf score out of 100
* Gives a rating such as "Very good", "Worth going" or "Probably not"
* Shows the reason behind the rating
* Shows forecast conditions for several days
* Lets you select different forecast times
* Shows how the swell is approaching the beach
* Allows people to submit local surf reports
* Works as a Progressive Web App

## The surf rating

The rating is made specifically around the conditions at Barleycove instead of just using a general surf rating.

It looks at:

* Swell direction
* How directly the swell approaches the beach
* Swell height
* Swell period
* Wind direction
* Wind speed
* Tide

The different parts are given different weights because some conditions matter more than others.

For example, a good swell direction and a long period are more important than having a slightly better tide. The rating is not meant to replace actually looking at the waves, but it gives a quick idea of whether it is worth checking the beach.

## Forecast

The forecast data comes from Windy and is used to calculate the conditions at Barleycove.

The main forecast point is:

`51.46716, -9.77497`

The site lets you select individual forecast times, which updates the conditions, surf score, explanation and swell map at the same time.

This makes it possible to look through the forecast and find the better parts of the day instead of only seeing the current conditions.

## Local surf reports

There is also a local report system where people can enter:

* Wave height
* Wave shape
* Crowd level

These reports are stored using Supabase so they can be seen by other people visiting the website.

The idea is that the forecast can give an estimate, while actual reports from people at the beach can show what the waves are really like.

## Map

The map is centred around the Barleycove surf area.

The swell direction is shown on the map and changes when a different forecast time is selected. It also shows the approximate angle between the incoming swell and the beach.

This is useful because the same wave height can produce very different conditions depending on which direction the swell is coming from.

## Tide

Tide predictions are taken from the Marine Institute's tide data for Castletownbere.

The tide is used both in the conditions display and as part of the surf rating.

Barleycove can work on different stages of the tide, so the tide is only one part of the rating rather than deciding whether the surf is good or bad on its own.

## PWA

Barleycove Surf can be installed on a phone as an app.

It uses a service worker to cache the website and a web app manifest so it can be added to the home screen.

The forecast itself still needs an internet connection to get new data, but the website shell can be loaded from the cache.

## Built with

* HTML
* CSS
* JavaScript
* Leaflet
* Supabase
* Netlify Functions
* Windy forecast data
* Marine Institute tide data
* Open-Meteo marine data

## Why I made it

I made this mainly as a project to learn more about working with APIs, JavaScript and data.

I also wanted something that I could actually use myself. Barleycove is one of the beaches I surf at, so having a forecast made specifically for the beach is more useful to me than making another general weather website.

There are still things that could be improved, especially making the surf rating more accurate using more local observations and eventually getting better information about how different swell directions interact with the beach.

## Website

[barleycovesurf.netlify.app](https://barleycovesurf.netlify.app)

## Status

The website is currently live and usable.

I will probably keep changing the rating and forecast as I get more observations from Barleycove and find better data sources.
