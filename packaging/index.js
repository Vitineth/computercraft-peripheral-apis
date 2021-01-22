import {existsSync} from 'fs';
import {readFile, writeFile, opendir} from 'fs/promises';
import * as zod from 'zod';
import {join, extname, dirname, basename} from 'path';

// Using my own color functions because its easier
const red = (data) => `\u001b[31m${String(data)}\u001b[39m`;
const bold = (data) => `\u001b[1m${String(data)}\u001b[22m`;
const cyan = (data) => `\u001b[36m${String(data)}\u001b[39m`;
const green = (data) => `\u001b[32m${String(data)}\u001b[39m`;

// Using a module format to get better tree shaking so need to emulate the __dirname
// constant but I only know how to do this if its a file url so check for that and fail
// otherwise. The url also includes the filename, so if its the right format we then
// trim off the file:// bit and also get the dirname of it.
if(!import.meta.url.startsWith('file:///')){
    console.log(red('Current URL doesn\'t seem to be a file! Stopping because I can\'t trust what I\'m doing anymore'));
    process.exit(1);
}

let __dirname = dirname(import.meta.url.substr(7));

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

/**
 * Asynchronously walks through a directory and yields all files it meets. 
 * Source: https://gist.github.com/lovasoa/8691344
 * @param {string} dir the directory to start the walk
 */
async function* walk(dir) {
    for await (const d of await opendir(dir)) {
        const entry = join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry);
        else if (d.isFile()) yield entry;
    }
}

async function loadAndValidateJSON(file, validator){
    let content;

    // Safely load the files
    try{
        content = await readFile(file, {encoding: 'utf8'});
    }catch(e){
        console.log(red(`Failed to read file '${file}'. The error was: ${e.message}`));
        console.log(red('    Stopping processing of all files'));

        // We will stop processing when we encounter any errors
        return false;
    }

    // Then safely try and parse it as JSON
    let parsed;

    try{
        parsed = JSON.parse(content);
    }catch(e){
        console.log(red(`Failed to parse file '${file}'. The error was: ${e.message}`));
        console.log(red('    Stopping processing of all files'));

        // We will stop processing when we encounter any errors
        return false;
    }

    // Then check that it passes the validator
    const validate = validator.safeParse(parsed);

    if(!validate.success){
        console.log(red(`Failed to validate file '${file}'. The validation errors are as follows:`));
        console.log(validate.error);
        console.log();
        console.log(red('    Stopping processing of all files'));

        // We will stop processing when we encounter any errors
        return false;
    }

    return validate.data;
}

async function launch(){
    const modFiles = [];
    const deviceFiles = [];

    // Load all mod JSON and device JSON file paths and store them ready for loading. 
    for await (const file of walk(join(__dirname, '..', 'data', 'mods'))){
        if (extname(file) === '.json'){
            modFiles.push(file);
        }
    }

    for await (const file of walk(join(__dirname, '..', 'data', 'devices'))){
        if (extname(file) === '.json'){
            deviceFiles.push(file);
        }
    }

    // Now we want to load each of these files. This takes the following steps
    // * Load the file
    // * Check that its valid JSON by parsing it
    // * Check that it matches the validator
    // * Check that it is not already present (duplicated ids)

    const mods = {};
    const devices = {};

    // Start with mods
    for(const file of modFiles){
        const mod = await loadAndValidateJSON(file, MOD_VALIDATOR);
        if(mod === false || mod === undefined) {
            process.exit(1);
        }
        
        // Check that this mod does not already exist
        if(Object.prototype.hasOwnProperty.call(mods, mod.identifier)){
            console.log(red('This mod is already defined! '));
            console.log(red('    Stopping processing of all files'));
            process.exit(1);
        }

        // And if it doesn't then save it!
        mods[mod.identifier] = mod;
    }

    // Then do devices. Ids are processed combining the owner and the id to allow for two mods with the same device
    for(const file of deviceFiles){
        const device = await loadAndValidateJSON(file, DEVICE_VALIDATOR);
        if(device === false || device === undefined) {
            process.exit(1);
        }
        
        // Check that this mod does not already exist
        if(Object.prototype.hasOwnProperty.call(devices, device.owner + '.' + device.id)){
            console.log(red('This device is already defined! '));
            console.log(red('    Stopping processing of all files'));
            process.exit(1);
        }

        // And if it doesn't then save it!
        devices[device.owner + '.' + device.id] = device;
    }

    // Once that's all good we want to make sure that every device has a valid owner!
    for(const device of Object.values(devices)){
        if(!Object.prototype.hasOwnProperty.call(mods, device.owner)){
            console.log(red(`Device ${bold(device.id)} does not have a valid owner. It specified ${bold(device.owner)} but this does not appear in any mod files`));
            console.log(red('    Stopping processing of all files'));
            process.exit(1);
        }
    }

    // Now we need to build up the specification object, which basically means changing a couple of keys
    // because I'm an inconsistent person
    const specification = {
        names: {},
        devices: [],
    };

    for (const mod of Object.values(mods)) {
        specification.names[mod.identifier] = {
            name: mod.name,
            color: mod.color,
        }
    }

    for (const device of Object.values(devices)) {
        specification.devices.push({
            name: device.name,
            owner: device.owner,
            identifier: device.defaultIdentifier,
            id: device.id,
            functions: device.functions,
        });
    }

    // Then we log and finally write out the file
    console.log(cyan(`Specification has been built! It contains ${bold(Object.values(mods).length)} mod(s) and ${bold(specification.devices.length)} device(s)`));
    console.log(cyan('Writing specification to ../resources/spec.json'));

    const outputPath = join(__dirname, '..', 'resources', 'spec.json');
    try{
        await writeFile(outputPath, JSON.stringify(specification), {encoding: 'utf8'});
        console.log(green(bold('Wrote successfully!')));
    } catch (e) {
        console.log(red(`Failed to write file to '${outputPath}'. The error was: ${e.message}`));
        process.exit(1);
    }
}

void launch();