const path = require('path');
const fs = require('fs');
const prompts = require('prompts');
const args = process.argv.slice(2);

// Using my own color functions because its easier
const red = (data) => `\u001b[31m${String(data)}\u001b[39m`;
const bold = (data) => `\u001b[1m${String(data)}\u001b[22m`;
const italic = (data) => `\u001b[3m${String(data)}\u001b[23m`;
const orange = (data) => `\u001b[33m${String(data)}\u001b[39m`;
const cyan = (data) => `\u001b[36m${String(data)}\u001b[39m`;

const AUTO_SWAP_ID_REGEX = /^([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)_[0-9]+/i;
const DEVICE_NAME_REGEX = /^[a-zA-Z0-9_-]+:?[a-zA-Z0-9_-]+/i;

// If a command line arg is given, load from the file given by the path
// If none is given, read from stdin IF its coming from a pipe (not a tty)
// Otherwise fail
let fileData;
if (args.length === 0) {

    // Can't read stdin from a tty like this so fail if that is what is currently in use
    if (process.stdin.isTTY) {
        console.log(red('stdin can only be used when piped in, not from a tty'));
        process.exit(1);
    }

    // Otherwise read from the stdin file descriptor as utf8
    fileData = data = fs.readFileSync(process.stdin.fd, 'utf-8');

} else if (args.length === 1) {

    // Try to read from the file given on standard input, outputting a formatted error if it is invalid
    try {
        fileData = fs.readFileSync(args[0], { encoding: 'utf8' });
    } catch (e) {
        console.log(red(bold('failed to read file path given due to error: ') + e.message));
        process.exit(1);
    }

} else {

    // Anything else is just wrong
    throw new Error('invalid number of parameters, 0 or 1 allowed');

}

// Safely parse the data
let data;
try {
    data = JSON.parse(fileData);
} catch (e) {
    console.log(red(bold('failed to parse JSON file due to error: ') + e.message));
    process.exit(1);
}

async function launch() {
    // Then we want to go through each device given
    for (const device of Object.keys(data)) {
        // If we don't know how to parse the name of it, then give up, we're not going to try too hard because this is a utility script
        // This expects things in the format of ic2:macerator_0
        if (!DEVICE_NAME_REGEX.test(device)) {
            console.log(orange(`Name ${bold(device)} does not match the regex so skipping it. If you know this is right, fix the regex`));
            continue;
        }

        // Split out the owner (ie ic2) and the name of the device (ie macerator_0) and print it out to give context to whats happening
        // and realistically where we fail
        let [owner, deviceWithoutOwner] = device.split(':');

        if(deviceWithoutOwner === undefined){
            console.log(cyan(`Trying to process ${bold(owner)} without an owner!`));
            deviceWithoutOwner = owner;
            owner = (await prompts({
                type: 'text',
                name: 'id',
                message: 'Device Owner',
            })).id;
        }

        console.log(cyan(`Processing ${bold(deviceWithoutOwner)} from ${bold(owner)}`));

        const functions = [];

        // For every function listed in the docs
        for (const [name, docs] of Object.entries(data[device])) {
            
            // We only know how to parse functions so skip any that aren't like that
            if (!docs.startsWith('function')) {
                console.log(orange(`cannot parse ${bold(name)} because it is not a function`));
                continue;
            }

            // Split out the definition and the description. This assumes the standard computercraft/ic2 way of doing this but hopefully
            // this is universal. If not, we'll have to update the script
            let [definition, description] = docs.split(' -- ');
            if (definition === undefined || description === undefined) {
                console.log(orange(`cannot parse ${bold(name)} because it is not of the right format`));
                continue;
            }

            // This function parses the parameters in a little bit of a hacky way. It steps through, recursing on each parameter
            // until it builds up a whole array of them including their types and optional status
            const readParams = (index, params, biasOptional) => {
                let name = '';
                let type = '';
                let isOptional = biasOptional === undefined ? false : biasOptional;
                let mode = 'name';

                while (index < definition.length) {
                    const char = definition.charAt(index);

                    // Close bracket means end of the function definition to break out of the loop and return whatever is currently parsed
                    if (char === ')') {
                        break;
                    }

                    // Open bracket means optional but this can either be that this parameter is optional or the next parameter is optional
                    if (char === '[') {
                        // If we were parsing type then it means it must indicate the next parameter is optional or if we are already
                        // optional it has the same effect. In that case, recurse down, skipping the [, notation. We use the bias optional
                        // parameter here to tell it we know that the parameter is optional from the start
                        if (isOptional || mode === 'type') {
                            return readParams(index + 2, params.concat({
                                name: name.trim(),
                                type: type.trim(),
                                optional: isOptional,
                            }), true);
                        } else {
                            // Otherwise, it means that this parameter is optional so update it, consume the character and continue
                            isOptional = true;
                            index++;
                            continue;
                        }
                    }

                    // A comma means the next parameter so return whats read from that point forward combined with the array
                    // we were given and the current parameter
                    if (char === ',') {
                        return readParams(index + 1, params.concat({
                            name: name.trim(),
                            type: type.trim(),
                            optional: isOptional,
                        }));
                    }

                    // Close bracket means the end of this parameter (probably) so we need to return the index we are at and the
                    // parameters we were given combined with the one we are currently reading
                    // This is the block most likely to fail but it seems to work from testing
                    if (char === ']') {
                        return [index, [].concat(params).concat([{
                            name: name.trim(),
                            type: type.trim(),
                            optional: isOptional,
                        }])];
                    }

                    // Colon means that we are moving from the name of it to the type of it because they are all in the format name:type
                    // Need to make sure we consume the character and then keep going
                    if (char === ':') {
                        mode = 'type';
                        index++;
                        continue;
                    }

                    // Otherwise this character isn't special so we just add it to either the name of the type, whatever we are processing currently
                    if (mode === 'name') {
                        name += definition.charAt(index);
                        index++;
                    } else {
                        type += definition.charAt(index);
                        index++;
                    }

                }

                // If we break and reach the end we need to return this parameter. If we didn't gather any name it means that there
                // wasn't a parameter to fetch so return the array we were given and the point we reached
                if (name === '') return [index, params];

                // Otherwise return the array we were given with this entry attached
                return [index, [].concat(params).concat([{
                    name: name.trim(),
                    type: type.trim(),
                    optional: isOptional,
                }])];
            }

            const readReturn = (index) => {
                // Consume all characters either until the end or until we reach a colon
                while (index < definition.length && definition.charAt(index) !== ':') index++;

                // If it went over the end this function returns nothing
                if (index >= definition.length) return "void";

                // If not, substring from the colon and trim it, that'll be the return value
                return definition.substr(index + 1).trim();
            }

            // Get the parameters and the return value function the function definition
            const [nextChar, parameters] = readParams(9, []);
            const returnValue = readReturn(nextChar);

            // Convert them into the format required by the packaging script
            const outputParameters = parameters.map((e) => ({
                name: e.name,
                type: e.type,
                description: e.optional ? 'Is optional' : '',
            }));

            // Now convert this into a parameter string like I like them, in the typescript style
            const parameterTypeString = parameters.map((e) => `${e.name}${e.optional ? '?' : ''}: ${e.type}`).join(', ');
            const functionName = `.${name}(${parameterTypeString})`;

            // And push the function declaration. Omit the parameters if there are none because the webpage will handle
            // them then and omit the return value if it was void because there is a special case for that in the
            // loading code as well
            functions.push({
                name: functionName,
                parameters: outputParameters.length === 0 ? undefined : outputParameters,
                return: returnValue === 'void' ? undefined : returnValue,
                description,
            });
        }

        // Now we need to figure out some details about the device for the file
        let defaultID;
        let deviceID;

        // Certain IDs we can automatically process, namely those in the format `mod:some_device_0`
        // So if it matches, extract the device name and automatically build up the generated device name
        if(AUTO_SWAP_ID_REGEX.test(device)){
            const [, ownerID, deviceName] = AUTO_SWAP_ID_REGEX.exec(device);

            deviceID = deviceName;
            defaultID = ownerID + ':' + deviceID + '_(n)';
        }else{
            // Otherwise we need to prompt the user for the values that they want to use for this script
            defaultID = (await prompts({
                type: 'text',
                name: 'id',
                message: 'Default Device Identifier',
            })).id;

            deviceID = (await prompts({
                type: 'text',
                name: 'id',
                message: 'Device Identifier',
            })).id;
        }

        // Finally we don't want to risk messing up the device name so we will just ask them for it
        const name = (await prompts({
            type: 'text',
            name: 'id',
            message: 'Device Name',
        })).id;

        if(name === "quit"){
            process.exit(1);
        }

        // Build up the device output in the format required by the packaging script ready to be written
        const deviceOutput = {
            id: deviceID,
            owner,
            name,
            defaultIdentifier: defaultID,
            functions,
        }

        // We know we are going to have to write this in the mod folder to build up the path to it
        const outputFolder = path.join(__dirname, '..', 'data', 'devices', owner);

        // Try and make all the folders to this point. If it had to create the mod folder, warn them that they will now have to make a mod file
        // for their definition to actually work
        try{
            const created = fs.mkdirSync(outputFolder, {
                recursive: true,
            });

            if(created !== undefined)console.log(orange(`Folder had to be created for ${bold(owner)}, you may need to now create a mod file`));
        }catch(e){
            // Folders already existing don't matter, any other errors do
            if(e.code !== 'EEXIST'){
                throw e;
            }
        }

        // Get the path they will actually want to write to
        const outputFile = path.join(outputFolder, deviceID + '.json');

        // Don't ever overwrite an existing file. Mainly because existing files could have been tweaked by a person and we don't want
        // to accidentally delete their data. If they want to do that, then they can delete the file.
        // TODO: make this a command line flag
        if(fs.existsSync(outputFile)){
            console.log(red(`File ${bold(outputFile)} already exists, not outputting`));
            continue;
        }

        // Then try and write out the file printing a message when they do.
        try{
            await fs.promises.writeFile(outputFile, JSON.stringify(deviceOutput, null, 1));
            console.log(italic(`File written at ${bold(cyan(outputFile))}`))
        }catch(e){
            console.log(red(`Failed to write device file due to error: ${bold(e.message)}`));
        }
    }
}

void launch();