# computercraft-peripheral-apis

This repo contains the code used to render the computercraft peripheral APIs index. All data is generated from the device JSON files in `data/devices/**/*.json`. These files are compiled together into a single minified specification by the `packaging/index.js` file which emits it to `resources/spec.json` which can then be published to the server. Styles are written in scss in `resources/scss/**/*.scss` and then compiled into CSS in the folder `resources/css/**/.css`.

## Contributing

### Adding a device to an existing mod definition

Create the file `data/devices/<mod>/<device>.json` and then run `bin/package.json` to build everything together

The format of the device file is described by the following zod schema (this is copied from the packaging file)

```javascript
const PARAMETER_VALIDATOR = zod.object({
    /**
     * The name of the parameter as given by the lua function
     */
    name: zod.string(),
    /**
     * The type, if it is not possible to specify, please use 'unknown' or 'any'.
     */
    type: zod.string(),
    /**
     * The description of the parameter. What it does, etc
     */
    description: zod.string(),
});

const FUNCTION_VALIDATOR = zod.object({
    /**
     * The name of the function. This should be expressed as the full name including parameters such as '.doSomething(x)' All functions should start with a dot
     */
    name: zod.string().refine((arg) => arg.startsWith('.')),
    /**
     * The parameters, if the functions take any. This should be an array of objects, as described in the PARAMETER_VALIDATOR object
     */
    parameters: zod.array(PARAMETER_VALIDATOR).optional(),
    /**
     * A description of the return value. 
     */
    return: zod.string().optional(),
    /**
     * A description of the function. Provide as much detail as possible about what it does, any side effects it has etc
     */
    description: zod.string(),
    /**
     * An example piece of code.
     */
    demo: zod.string().optional(),
})

const DEVICE_VALIDATOR = zod.object({
    /**
     * The unique ID of this device, this is used internally and is not displayed
     */
    id: zod.string(),
    /**
     * The owner of the device which should be defined in a mod definition file
     */
    owner: zod.string(),
    /**
     * The name of the device in human readable format (like Reactor Access Hatch)
     */
    name: zod.string(),
    /**
     * The default identifier of the object when wrapped as a peripheral over modem for example. To represent a number, you can use (n) in the format
     * `ic2:react_access_hatch_(n)`
     */
    defaultIdentifier: zod.string(),
    /**
     * The set of functions this device has. This is an array of functions as described in FUNCTION_VALIDATOR
     */
    functions: zod.array(FUNCTION_VALIDATOR)
});
```

### Adding a new mod

Create the device file in `data/devices/<mod>/<device>.json`. You will then need to create a mod definition file in `data/mods/<mod>.json`. This file defines the mod name, and the tag colour. When picking colours please choose one that provides good contrast to white text and has not been used by another mod. 

The format of the mod file is described the following zod schema (copied from the packaging script)

```javascript
const MOD_VALIDATOR = zod.object({
    /**
     * The unique identifier for this mod. This is what will be shown in the tag so should be kept short like 'IC2' or 'AE2'
     */
    identifier: zod.string(),
    /**
     * The readable name of the mod. This is shown as the header in the sidebar so should be readable like 'IndustrialCraft2' or 'Applied Energistics'
     */
    name: zod.string(),
    /**
     * The colour of the tag as a hex color code. This should provide good contrast for white text and be unique across all mods.
     */
    color: zod.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i),
});
```

## Packaging

The packaging script is managed by the `packaging/` folder which contains a NodeJS project. It will validate the content of all the files before packaging them into the specification files. 

## Scraping Docs

A utility script it provided to be able to fetch the `.getDocs()` call encoded as JSON. The script with no arguments will dump the result to the command line. This will only work with peripherals that can be addressed with their actual IDs (for example attached via a modem). It will skip the named sides because the parsing script expects the result to not include them. It takes one parameter which is a web address to which it will POST the data encoded as JSON. This is designed so you can post it to your own server, grab the data and then run it through the parsing script.

You can run it like this

```
wget run https://raw.githubusercontent.com/Vitineth/computercraft-peripheral-apis/main/scraper.lua <url>
```

If you take the JSON it sends and save it to a file (eg `data.json`), you can then run it through the parser like

```
node parsing/parse.js data.json
```

Which will spit out data files, you will be prompted to answer any questions it can't determine from the data, along with the name of the devices (automatic generation support for names coming soon).

And if all these files produce successfully, you can then package it all up like this

```
node packaging/index.js
```

And if that works, you can open a pull request with your new data and it will get merged in and deployed on to the website!