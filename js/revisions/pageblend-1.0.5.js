(function(window,$,initiate){ 'use strict';

    var serializeObject = function($element) {
            var o = {};
            var a = $element.serializeArray();
            $.each(a, function() {
                if (o[this.name] !== undefined) {
                    if (!o[this.name].push) {
                        o[this.name] = [o[this.name]];
                    }
                    o[this.name].push(this.value || '');
                } else {
                    o[this.name] = this.value || '';
                }
            });
            return o;
        },
        regexEscape = function(string) {
            return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        },
        whenImagesLoaded = function($container,handler) {
            //TODO check background images?
            var image_cache = {},
                images_pending = 0;

            $container.find('img').each(function(){
                var image = this,
                    $image = $(this);

                if (image.src) {
                    var image_ready = ((image.complete && image.naturalWidth >= 0) || image.readyState === 4 || image.readyState === 'complete');
                    if (!image_ready && !image_cache[image.src]) {
                        image_cache[image.src] = {origin:image,$origin:$image,proxy:false};
                    }
                }
            });

            var proxy_image_event = function(){
                images_pending--;
                if (images_pending == 0) {
                    handler();
                    image_cache = null;
                }
            };

            for (var image_cache_src in image_cache) {
                if (image_cache.hasOwnProperty(image_cache_src) && !image_cache[image_cache_src].proxy) {
                    (function(image_cache_src){
                        var proxy_image = new Image();
                        images_pending++;
                        image_cache[image_cache_src].proxy = proxy_image;
                        proxy_image.onload = function(){
                            if (image_cache) {
                                delete image_cache[image_cache_src];
                                proxy_image_event();
                            }
                        };
                        proxy_image.onerror = function(){
                            if (image_cache) {
                                delete image_cache[image_cache_src];
                                proxy_image_event();
                            }
                        };
                        proxy_image.src = image_cache_src;
                    })(image_cache_src);
                }
            }

            if (images_pending == 0) {
                handler();
            }
        },
        history_support = (!!window.history && !!window.history.pushState);

    var PageBlend = function(){
        this.properties = {
            initiated:false,
            source_name:'PageBlend',
            event_namespace:'PageBlend',
            event_listeners:{},
            images_cache:{},
            processing:false,
            element:false,
            target:'',
            url:''
        };
        this.settings = {
            delay:600,
            timeout:10000, //TODO needs functionality adding
            wait_for_images:true,
            default_target:false
        };

        if (initiate) this.initiate();
    };

    PageBlend.prototype.process = function(url,method,params,target,push){ var self = this;
        if (!history_support) {
            if (url) window.location.href = url;
            return false;
        }

        url = url || '';
        method = (method && method.toUpperCase() === 'POST') ? 'POST' : 'GET';
        //target = !!target;
        params = params || {};
        push = (push || typeof push === "undefined") ? true : false;

        var origin = window.location.protocol+'//'+window.location.host;

        // validate url, if not valid or external, return false
        // permits a https call when on http but not the other way around.
        if (url.match(/^http|https:\/\//)) {
            if (!url.match(new RegExp('^'+regexEscape(origin)))
                && !url.match(new RegExp('^'+regexEscape(origin.replace(/^http:\/\//,'https://'))))) {
                return false;
            }
        }

        if (self.properties.processing && self.properties.processing.abort) self.properties.processing.abort();

        self.properties.url = url;
        self.properties.target = (target) ? target : self.settings.default_target;

        // It is possible to change the url with this event before the ajax request. Use "this.properties.url"
        self.trigger('before_change',self.properties.url,self.properties.element);

        url = self.properties.url;
        target = self.properties.target;

        var ready = false,
            timeout = false,
            timer = setTimeout(function(){
                timeout = true;
                if (ready) ready();
            },self.settings.delay),
            process_response = function(response,status){
                var error = true;

                if (!!response) {
                    response = response.replace('<body','<div').replace('</body','</div');
                    var $response = $(response),
                        $response_body = $response.filter('div:first').eq(0),
                        $current_target = (target) ? $(target).eq(0) : {length:0},
                        $response_target = (target) ? $response_body.find(target).eq(0) : {length:0};

                    if (!$current_target.length && !$response_target.length) {
                        $current_target = $('.page-blend-container').eq(0);
                        $response_target = $response_body.find('.page-blend-container').eq(0);
                    }

                    if (!$current_target.length && !$response_target.length) {
                        $current_target = $('body').eq(0);
                        $response_target = $response_body;
                    }

                    if ($current_target.length && $response_target.length) {
                        var complete_change = function(){
                            var state = {target:target,source:self.properties.source_name},
                                title = $response.filter('title').eq(0).text() || document.title;

                            document.title = title;
                            if (push) window.history.pushState(state,title,url);
                            $current_target.html($response_target.html());
                            self.properties.element = false;
                            self.properties.url = '';
                            self.trigger('after_change',status,url,$response_target.get(0),$current_target.get(0));
                        };

                        if (self.settings.wait_for_images) whenImagesLoaded($response_target,complete_change);
                        else complete_change();
                    }
                    else {
                        window.location.href = url;
                    }

                    error = false;
                }

                if (error) { //error (notmodified, nocontent, error, timeout, abort, parseerror)
                    self.trigger('after_change',status,url,false,false);
                }
            };

        self.properties.processing = $.ajax({
            url:url,
            type:method,
            data:params,
            dataType:'html',
            async:true,
            complete:function(jqXHR,textStatus) {
                if (timeout) process_response(jqXHR.responseText,textStatus);
                else ready = function(){process_response(jqXHR.responseText,textStatus);};
                self.properties.processing = false;
            }
        });

        return true;
    };

    PageBlend.prototype.initiate = function(){ var self = this;
        if (!history_support) return self;
        if (!self.properties.initiated) {
            // add event listeners
            $('html')
                .on('click.'+self.properties.event_namespace,'a',function(e){
                    var $a = $(this),
                        url = $a.attr('href'),
                        disable = false,
                        target = false;

                    $.each($a.add($a.parents()).toArray().reverse(),function(){
                        var $this = $(this),
                            this_disable = $this.data('pb-disable'),
                            this_target = $this.data('pb-target');
                        if (typeof this_disable !== 'undefined' && this_disable !== '') disable = this_disable;
                        if (typeof this_target !== 'undefined' && this_target !== '') target = this_target;
                    });

                    self.properties.element = this;

                    if (!disable && url && !url.match(/^(?:javascript:|#)/) && self.process(url,'GET',false,target)) {
                        e.preventDefault();
                    }
                })
                .on('submit.'+self.properties.event_namespace,'form',function(e){
                    var $form = $(this),
                        url = $form.attr('action'),
                        method = $form.attr('method'),
                        disable = false,
                        target = false;

                    $.each($form.add($form.parents()).toArray().reverse(),function(){
                        var $this = $(this),
                            this_disable = $this.data('pb-disable'),
                            this_target = $this.data('pb-target');
                        if (typeof this_disable !== 'undefined' && this_disable !== '') disable = this_disable;
                        if (typeof this_target !== 'undefined' && this_target !== '') target = this_target;
                    });

                    self.properties.element = this;

                    if (!disable && url && self.process(url,method,serializeObject($form),target)) {
                        e.preventDefault();
                    }
                });

            /* Potential change here; make popstate (back button) support POST with params */
            $(window).on('popstate.'+self.properties.event_namespace,function(e){
                if (e.originalEvent.state && e.originalEvent.state.source === self.properties.source_name) {
                    self.process(window.location.href,false,false,(e.originalEvent.state.target ? e.originalEvent.state.target : false),false);
                }
            });

            var existing_state = window.history.state;
            if (!existing_state || existing_state.source !== self.properties.source_name) {
                var state_changed = false;
                if (!existing_state) {
                    existing_state = {source:self.properties.source_name};
                    state_changed = true;
                }
                else if (typeof existing_state === "object" && !(existing_state instanceof Array)) {
                    existing_state.source = self.properties.source_name;
                    state_changed = true;
                }
                if (state_changed) {
                    window.history.replaceState(existing_state,document.title,document.location.href);
                }
            }

            self.properties.initiated = true;
        }
        return self;
    };

    PageBlend.prototype.uninitiate = function(){ var self = this;
        $('html').off('.'+self.properties.event_namespace);
        $(window).off('.'+self.properties.event_namespace);
        self.properties.initiated = false;
        return self;
    };

    PageBlend.prototype.reinitiate = function(){ var self = this;
        self.uninitiate();
        self.initiate();
        return self;
    };

    PageBlend.prototype.trigger = function(event){ var self = this;
        var args = Array.prototype.slice.call(arguments,1), event_parts = event.split('.',2), event_type = event_parts[0], event_name = (event_parts[1]) ? event_parts[1] : false;
        if (self.properties.event_listeners[event_type]) {
            for (var current_event_name in self.properties.event_listeners[event_type]) {
                if (self.properties.event_listeners[event_type].hasOwnProperty(current_event_name)
                    && (event_name === false || event_name === current_event_name)) {
                    for (var i=0; i<self.properties.event_listeners[event_type][current_event_name].length; i++) {
                        if (self.properties.event_listeners[event_type][current_event_name][i]) {
                            self.properties.event_listeners[event_type][current_event_name][i].apply(self,args);
                        }
                    }
                }
            }
        }
        return self;
    };

    PageBlend.prototype.on = function(event,handler){ var self = this;
        var event_parts = event.split('.',2), event_type = event_parts[0], event_name = (event_parts[1]) ? event_parts[1] : '_default';
        if (!self.properties.event_listeners[event_type]) self.properties.event_listeners[event_type] = {};
        if (!self.properties.event_listeners[event_type][event_name]) self.properties.event_listeners[event_type][event_name] = [];
        self.properties.event_listeners[event_type][event_name].push(handler);
        return self;
    };

    PageBlend.prototype.off = function(event,handler){ var self = this;
        var event_parts = event.split('.',2), event_type = event_parts[0], event_name = (event_parts[1]) ? event_parts[1] : false;
        if (self.properties.event_listeners[event_type]) {
            for (var current_event_name in self.properties.event_listeners[event_type]) {
                if (self.properties.event_listeners[event_type].hasOwnProperty(current_event_name)
                    && (event_name === false || event_name === current_event_name)) {
                    if (handler) {
                        for (var i=0; i<self.properties.event_listeners[event_type][current_event_name].length; i++) {
                            if (self.properties.event_listeners[event_type][current_event_name][i] === handler) {
                                self.properties.event_listeners[event_type][current_event_name].splice(i,1);
                                i--;
                            }
                        }
                    }
                    else self.properties.event_listeners[event_type][current_event_name] = [];
                }
            }
        }
        return self;
    };

    $.PageBlend = new PageBlend();

})(window,jQuery,true);