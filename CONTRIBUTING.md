# Contributing

Contributions are more than welcome! Here's a step by step guide to load up a mod from in game. This is the easy way but if you're writing the JSON by hand or doing some other crazy thing you can just skip down to point 5 to show how to package and contribute. 

## 1. Setup In Game Scrape

In game, computercraft must be able to make HTTP post requests (make sure its not forbidden by the configuration). You will then want to connect a computer to the device(s) with a Wired Modem and Network Cable. Make sure that the modems are enabled on the devices you want to scrape (have the red ring on them). Check out the picture in https://github.com/Vitineth/computercraft-peripheral-apis/pull/2 for an example of how I did the IC2 devices. 

## 2. Setup Web Endpoint

Next you need to find somewhere to send your data. Personally I use https://hookbin.com to make things easy (but this is not an endorsement, use whatever will let you get access to the POST body). If using hookbin, go to that address, press generate new endpoint and copy the URL listed.

## 3. Scrape

Now run the script in game to fetch the docs and post them to your endpoint

```bash
wget run https://raw.githubusercontent.com/Vitineth/computercraft-peripheral-apis/main/scraper.lua <url>
```

(if using hookbin, reload the page to see the result)

Copy the JSON body of the request and save it to a file somewhere (ie scrape.json)

## 4. Parse

Now you can parse the data! This can be done with the parsing script provided. Make sure that you have a working node installation (`node -v` prints a new-ish version), and that you have installed the required packages (`cd parsing && npm i`). Then from the base directory you can run:

```bash
node parsing/parse.js scrape.json
```

This will prompt you for any information it needs and should automatically write out the files where they should go. You'll get an output similar to this (this was from the ic2 scrape)

```
Processing rci_rsh_0 from ic2
✔ Device Name … Reactor Coolant Injector (RSH)
File written at /home/ryan/dev/scratch/computercraft-api/data/devices/ic2/rci_rsh.json
Processing item_buffer_0 from ic2
✔ Device Name … Item Buffer
File written at /home/ryan/dev/scratch/computercraft-api/data/devices/ic2/item_buffer.json
Processing pump_0 from ic2
✔ Device Name … Pump
File written at /home/ryan/dev/scratch/computercraft-api/data/devices/ic2/pump.json
```

Remember, item names don't always match the in game names so please double check your data

## 4.5 Mod Files

If you are doing a brand new mod, you will need to write a mod file! This is very easy. If you've used the parsing script you'll need to make a file with the owner name given (ie `from ic2` means a file `ic2.json`) and place it in `data/mods/`. This file is just more JSON which has the following fields:

```json
{
    "identifier": "<mod identifier: this is the same as the name of the file, ie ic2>",
    "name": "<mod name: the real name of the mod, ie IndustrialCraft2>",
    "color": "<tag color code, something with good contrast with white text, ie #000000>"
}
```

## 5. Package

Once you have made all the small data files, you can package it up into the specification which can be deployed to the site. Make sure that you have a working node installation (`node -v` prints a new-ish version), and that you have installed the required packages (`cd packaging && npm i`). Then from the base directory you can run:

```bash
node packaging/index.js
```

Resolve any errors this warns you about until you get an output like this

```
Specification has been built! It contains 1 mod(s) and 92 device(s)
Writing specification to ../resources/spec.json
Wrote successfully!
```

Once thats done you're ready to commit

## 6. Commit

Commit your data files and the packaged specification on your forked repo and open a pull request against the repository. When approved it will be merged in and eventually deployed to the website!