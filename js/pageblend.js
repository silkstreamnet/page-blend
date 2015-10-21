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
        whenImagesLoaded = function(html,handler) {

            var image_cache = {},
                images_pending = 0;

            $('<div/>').html(html).find('img').each(function(){
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
                }
            };

            for (var image_cache_src in image_cache) {
                if (image_cache.hasOwnProperty(image_cache_src) && !image_cache[image_cache_src].proxy) {
                    (function(image_cache_src){
                        var proxy_image = new Image();
                        images_pending++;
                        image_cache[image_cache_src].proxy = proxy_image;
                        proxy_image.onload = function(){
                            if (image_cache[image_cache_src].proxy !== true) {
                                image_cache[image_cache_src].proxy = true;
                                proxy_image_event();
                            }
                        };
                        proxy_image.onerror = function(){
                            if (image_cache[image_cache_src].proxy !== true) {
                                image_cache[image_cache_src].proxy = true;
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
        history_support = (!!window.history && !!window.history.replaceState);

    var PageBlend = function(){
        this.properties = {
            initiated:false,
            event_namespace:'PageBlend',
            event_listeners:{},
            delay:600,
            timeout:10000, //TODO needs functionality adding
            processing:false,
            element:false,
            url:'',
            images_cache:{},
            wait_for_images:true
        };

        if (initiate) this.initiate();
    };

    PageBlend.prototype.process = function(url,target,method,params){ var self = this;
        if (!history_support) return false;

        url = url || '';
        method = (method && method.toUpperCase() === 'POST') ? 'POST' : 'GET';
        target = target || false;
        params = params || {};

        var origin = window.location.protocol+'//'+window.location.host;

        // validate url, if not valid or external, return false
        // permits a https call when on http but not the other way around.
        if (url.match(/^http|https:\/\//)) {
            if (!url.match(new RegExp('^'+regexEscape(origin)))
                && !url.match(new RegExp('^'+regexEscape(origin.replace(/^http:\/\//,'https://'))))) {
                return false;
            }
        }
        else {
            //TODO if not a full url, prepend the website's domain (need to consider urls starting with / for absolute and without / for relative)
        }


        if (self.properties.processing && self.properties.processing.abort) self.properties.processing.abort();
        //TODO make sure returns full url? useful for google analytics? check if needed.
        self.properties.url = url;

        // It is possible to change the url with this event before the ajax request. Use "this.properties.url"
        self.trigger('before_change',self.properties.url,self.properties.element);

        var ready = false,
            timeout = false,
            timer = setTimeout(function(){
                timeout = true;
                if (ready) ready();
            },self.properties.delay),
            process_response = function(jqxhr,status){
                var error = true;

                if (status === 'success' && !!jqxhr.responseText) {
                    var $response = $(jqxhr.responseText),
                        $current_target = (target) ? $(target).eq(0) : {length:0},
                        $response_target = (target) ? $response.find(target).eq(0) : {length:0};

                    if (!$current_target.length || !$response_target.length) {
                        $current_target = $('.page-blend-container').eq(0);
                        $response_target = $response.find('.page-blend-container').eq(0);
                    }

                    if (!$current_target.length || !$response_target.length) {
                        $current_target = $('body');
                        $response_target = $response.find('body').eq(0);
                    }

                    if ($current_target.length && $response_target.length) {
                        var complete_change = function(){
                            $current_target.html($response_target.html());
                            self.trigger('after_change','success',url,self.properties.element);
                            self.properties.element = false;
                            self.properties.url = '';
                        };

                        if (self.properties.wait_for_images) whenImagesLoaded($response_target.html(),complete_change);
                        else complete_change();
                    }
                    else {
                        window.location.href = self.properties.url;
                    }

                    error = false;
                }

                if (error) { //error (notmodified, nocontent, error, timeout, abort, parseerror)
                    self.trigger('after_change','error',self.properties.url,self.properties.element);
                }
            };

        self.properties.processing = $.ajax({
            url:self.properties.url,
            type:method,
            data:params,
            complete:function(jqxhr,status){
                if (timeout) {
                    process_response(jqxhr,status);
                }
                else {
                    ready = function(){
                        process_response(jqxhr,status);
                    };
                }

                self.properties.processing = false;
            }
        });

        return true;
    };

    PageBlend.prototype.initiate = function(){ var self = this;
        if (!history_support) return;
        if (!self.properties.initiated) {
            // add event listeners
            $('html')
                .on('click.'+self.properties.event_namespace,'a',function(e){
                    var $a = $(this),
                        url = $a.attr('href'),
                        disable = $a.data('pb-disable'),
                        target = $a.data('pb-target');

                    self.properties.element = this;

                    if (!disable && url && self.process(url,target)) {
                        e.preventDefault();
                    }
                })
                .on('submit.'+self.properties.event_namespace,'form',function(e){
                    var $form = $(this),
                        url = $form.attr('action'),
                        method = $form.attr('method'),
                        disable = $form.data('pb-disable'),
                        target = $form.data('pb-target');

                    self.properties.element = this;

                    if (!disable && url && self.process(url,target,method,serializeObject($form))) {
                        e.preventDefault();
                    }
                });

            self.properties.initiated = true;
        }
    };

    PageBlend.prototype.clear = function(){ var self = this;
        $('html').off('.'+self.properties.event_namespace);
        self.properties.initiated = false;
    };

    PageBlend.prototype.reinitiate = function(){
        this.clear();
        this.initiate();
    };

    PageBlend.prototype.trigger = function(event){ var self = this;
        var args = Array.prototype.slice.call(arguments,1), event_parts = event.split('.',2), event_type = event_parts[0], event_name = (event_parts[1]) ? event_parts[1] : '_default';
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
    };

    PageBlend.prototype.on = function(event,handler){
        var event_parts = event.split('.',2), event_type = event_parts[0], event_name = (event_parts[1]) ? event_parts[1] : '_default';
        if (!self.properties.event_listeners[event_type]) self.properties.event_listeners[event_type] = {};
        if (!self.properties.event_listeners[event_type][event_name]) self.properties.event_listeners[event_type][event_name] = [];
        self.properties.event_listeners[event_type][event_name].push(handler);
    };

    PageBlend.prototype.off = function(event,handler){
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
    };

    $.PageBlend = new PageBlend();

})(window,jQuery,true);