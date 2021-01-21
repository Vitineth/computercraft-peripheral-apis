hljs.initHighlightingOnLoad();
$(function(){
    $.get('/resources/spec.json', (data) => {
        generateDocumentation(data);
    })
});

function generateDocumentation(data){
    let scrollingBindings = [];
    
    // === THIS IS THE ACTUAL DOT TEMPLATE ===
    //   However, doT requires implementing unsafe-eval on the content security policy which I don't really want to do
    //   so instead, I generate the functions (basically `console.log(doT.template(<<data>>))`) and copy them in by hand
    //   I might find a way to automate this later on. For now, I don't have to do updates very often so its fine
    //   The templates are left to show what is actually being generated.
    
    // const sidebarGroupTemplate = doT.template(`
    //     <div class="group">
    //         <h3>{{=it.name}}</h3>
    //         {{~ it.entries :p }} 
    //         <div class="entry" data-pending-scroll="true" data-scroll-to="{{=p.scrollTo}}">
    //             <div class="tag" style="background-color: {{=it.color}}">{{=it.tag}}</div>
    //             <div>{{=p.name}}</div>
    //         </div>
    //         {{~}}
    //     </div>`);

    // const deviceTemplate = doT.template(`
    //     <div class="entry left-only i0" data-scroll-to-me="{{=it.id}}">
    //         <h2>{{=it.name}}</h2>
    //         <p>Default identifier: <code class="lone">{{=it.identifier}}</code></p>
    //     </div>
    //     {{~ it.functions :func}}
    //     <div class="entry i2">
    //         <div class="left">
    //             <h3 class="code">{{=func.name}}</h3>
                
    //             {{? func.parameters }}
    //             <h5>Parameters</h5>
    //             <table class="params">
    //                 {{~ func.parameters :param }}
    //                 <tr>
    //                     <td class="code">{{=param.name}}</td>
    //                     <td class="code">{{=param.type}}</td>
    //                     <td>{{=param.description}}</td>
    //                 </tr>
    //                 {{~}}
    //             </table>
    //             {{?}}

    //             {{? func.return }}
    //             <h5>Return</h5>
    //             <p>{{=func.return}}</p>
    //             {{?? true }}
    //             <p>This function does not have a return value</p>
    //             {{?}}

    //             <h5>Description</h5>
    //             {{=func.description}}
    //         </div>

    //         <div class="right">
    //             {{? func.demo}}
    //             <pre data-pending-highlight="true"><code class="lua">{{=func.demo}}</code></pre>
    //             {{?}}
    //         </div>
    //     </div>
    //     {{~}}
    // `)

    // === THESE ARE THE EXPORTED DOT TEMPLATES ===

    const sidebarGroupTemplate = (function anonymous(it
        ) {
        var out=' <div class="group"> <h3>'+(it.name)+'</h3> ';var arr1=it.entries;if(arr1){var p,i1=-1,l1=arr1.length-1;while(i1<l1){p=arr1[i1+=1];out+='             <div class="entry" data-pending-scroll="true" data-scroll-to="'+(p.scrollTo)+'"> <div class="tag" style="background-color: '+(it.color)+'">'+(it.tag)+'</div> <div>'+(p.name)+'</div> </div> ';} } out+=' </div>';return out;
        })

    const deviceTemplate = (function anonymous(it
        ) {
        var out=' <div class="entry left-only i0" data-scroll-to-me="'+(it.id)+'"> <h2>'+(it.name)+'</h2> <p>Default identifier: <code class="lone">'+(it.identifier)+'</code></p> </div> ';var arr1=it.functions;if(arr1){var func,i1=-1,l1=arr1.length-1;while(i1<l1){func=arr1[i1+=1];out+=' <div class="entry i2"> <div class="left"> <h3 class="code">'+(func.name)+'</h3>  ';if(func.parameters){out+=' <h5>Parameters</h5> <table class="params"> ';var arr2=func.parameters;if(arr2){var param,i2=-1,l2=arr2.length-1;while(i2<l2){param=arr2[i2+=1];out+=' <tr> <td class="code">'+(param.name)+'</td> <td class="code">'+(param.type)+'</td> <td>'+(param.description)+'</td> </tr> ';} } out+=' </table> ';}out+=' ';if(func.return){out+=' <h5>Return</h5> <p>'+(func.return)+'</p> ';}else if(true){out+=' <p>This function does not have a return value</p> ';}out+=' <h5>Description</h5> '+(func.description)+' </div> <div class="right"> ';if(func.demo){out+=' <pre data-pending-highlight="true"><code class="lua">'+(func.demo)+'</code></pre> ';}out+=' </div> </div> ';} } out+=' ';return out;
        });

    // Elements into which to insert the elements once they are generated
    const sidebarInjector = $('#sidebar-insert');
    const contentInjector = $('#content-insert');

    // For each named entity in the specification, we want to process each one into sidebar entries and into the
    // actual device list. This has the side effect that only devices with an owner in the names block will be shown
    // on the document.
    Object.keys(data.names).forEach((key) => {
        // Find all devices with this owner, this is not the most efficient and may get slower the more names that are
        // present but for now this works as it will be dealing with a small amount of data.
        // TODO: migrate to converting the spec into devices grouped by owner on load which will provide a quick lookup
        const entries = data.devices.filter((e) => e.owner === key).map((entry) => {

            // Generate the device dom element and inject it into the body of the webpage
            const generated = $(deviceTemplate(entry));
            contentInjector.append(generated);

            // And then return this entry to be rendered in the sidebar
            return {
                name: entry.name,
                scrollTo: entry.id,
            };
        });

        // Build up the sidebar configuration with the name of the mod and the tag style
        const config = {
            name: data.names[key].name,
            tag: key,
            color: data.names[key].color,
            entries,
        };

        // And eventually insert the sidebar block with all the nice elements. This should ensure that the sidebar is in order
        // with the actual document. Assuming my logic is right. 
        const generated = $(sidebarGroupTemplate(config));
        sidebarInjector.append(generated);
    });

    // Any demo blocks are marked with a pending highlight so we need to go through and highlight them all using
    // the library. Once done remove the attribute to keep everything clean
    $('[data-pending-highlight]').each((index, element) => {
        hljs.highlightBlock(element);
        element.removeAttribute('data-pending-highlight');
    });

    // Sidebar elements are marked with pending scroll because we need to bind scrolling logic to them. When we click
    // a sidebar element it should scroll all the way down to the element. To do this we go through each element, get
    // where it is targeting and then when you click, scroll the body to that position.
    //
    // We also store the body element and the label element so we can dynamically highlight them when we scroll through
    // the page which is handled down below. We also remove each attribute as we process it to keep things clean
    $('[data-pending-scroll]').each((index, element) => {
        const e = $(element);
        const target = $("[data-scroll-to-me='" + e.attr('data-scroll-to') + "']");

        if(target.length === 0){
            console.warn('No value for ' + e.attr('data-scroll-to'));
            return;
        }

        scrollingBindings.push({
            element: $("[data-scroll-to-me='" + e.attr('data-scroll-to') + "']"),
            label: e,
        });

        e.click(function(){
            $([document.documentElement, document.body]).animate({
                scrollTop: $("[data-scroll-to-me='" + e.attr('data-scroll-to') + "']").offset().top
            }, 500);
        });

        element.removeAttribute('data-pending-scroll');
    });

    // Bind a listener to the window scroll event. This will be used to determine which entry should be kept active
    $(window).scroll(function(){
        // Get container scroll position
        var fromTop = $(this).scrollTop();
        
        // Get id of current scroll item
        // Basically get all elements which have the top of their elements above the top of the window
        // (that we are scrolled past the top). And filter out the undefined. This isn't the best method
        // but its copy-pasted so what can I do (other than be lazy)
        let cur = scrollingBindings.map(function(entry){
            if (entry.element.offset().top < fromTop)
                return entry;
        }).filter((e) => e !== undefined);
        
        // If there are more than two elements we want to work out which one needs showing
        if(cur.length >= 2){
            // Reduce the array down to the one who has the lowest offset.
            cur = [cur.reduce((previous, current) => {
                if(previous === undefined) return current;

                const previousOffset = fromTop - previous.element.offset().top;
                const currentOffset = fromTop - current.element.offset().top;

                if(previousOffset > currentOffset) return current;
                else return previous;
            })];
        }

        // Then remove active on all the elements and add active to the one that is in focus
        if(cur.length === 1 && cur[0] !== undefined){
            scrollingBindings.forEach((e) => e.label.removeClass('active'));
            cur[0].label.addClass('active');
        }
    });
}
