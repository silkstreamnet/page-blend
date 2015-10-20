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
    };

    var PageBlend = function(){
        this.properties = {
            initiated:false,
            event_namespace:'PageBlend',
            event_listeners:{},
            delay:600,
            processing:false,
            last_element:false
        };

        if (initiate) this.initiate();
    };

    PageBlend.prototype.process = function(url,target,method,params){ var self = this;
        url = url || '';
        method = (method && method.toUpperCase() === 'POST') ? 'POST' : 'GET';
        target = target || false;
        params = params || {};

        // validate url, if not valid or external, return false
        if (0) return false;

        self.trigger('before_change',self.properties.last_element);

        var ready = false,
            timeout = false,
            timer = setTimeout(function(){
                timeout = true;
                if (ready) ready();
            },self.properties.delay),
            process_response = function(jqxhr,status){
                var error = true;

                if (status === 'success' && !!jqxhr.responseText) {
                    var $jqxhr = $(jqxhr),
                        $current_target = (target) ? $(target).eq(0) : {length:0},
                        $response_target = (target) ? $jqxhr.find(target).eq(0) : {length:0};

                    if (!$current_target.length) $current_target = $('body');
                    if (!$response_target.length) $response_target = $jqxhr.find('body');
                    if (!$response_target.length) $response_target = $jqxhr.closest('body');

                    if ($current_target.length && $response_target.length) {

                        //TODO add images loaded listener

                        //TODO when images loaded, replace html and hide loading
                        $current_target.html($response_target.html());

                        error = false;
                    }
                }

                if (error) { //error (notmodified, nocontent, error, timeout, abort, parseerror)
                    //TODO show that there was an error
                    //TODO add button to hide loading
                }

                //TODO make sure returns full url? useful for google analytics? check if needed.
                self.trigger('after_change',url,self.properties.last_element);
            };

        if (self.properties.processing && self.properties.processing.abort) self.properties.processing.abort();

        // show loading

        self.properties.processing = $.ajax({
            url:url,
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
        if (!self.properties.initiated) {
            // add event listeners
            $('html')
                .on('click.'+self.properties.event_namespace,'a',function(e){
                    var $a = $(this),
                        url = $a.attr('href'),
                        disable = $a.data('pb-disable'),
                        target = $a.data('pb-target');

                    self.properties.last_element = this;

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

                    self.properties.last_element = this;

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