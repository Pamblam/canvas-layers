
/**
 * Interface for handling all canvas functionality
 * @see https://pamblam.github.io/canvas-layers/examples/
 * @version {{ VERSION }}
 */
class Canvas{
	
	/**
	 * Construct a new instance of the Canvas class
	 * @param {HTMLElement} canvas - The canvas to instantiate the class upon.
	 * @param {Number} [opts.anchorRadius=Canvas.anchorRadius] - The radius of the anchor points shown on selected elements.
	 * @param {String} [opts.strokeStyle=Canvas.strokeStyle] - The color of the outlines drawn on selceted elements. May be any valid CSS color string.
	 * @param {String} [opts.fillStyle=Canvas.fillStyle] - The color of the anchor points shown on selected elements. May be any valid CSS color string.
	 * @param {Number} [opts.lineWidth=Canvas.lineWidth] - The width of the outlines shown on selected elements.
	 * @param {String} [opts.cursors.default=Canvas.cursors.default] - The default cursor to use when hovering over the canvas. May be any valid css cursor value.
	 * @param {String} [opts.cursors.grab=Canvas.cursors.grab] - The grab cursor to use when hovering over a movable layer. May be any valid css cursor value.
	 * @param {String} [opts.cursors.grabbing=Canvas.cursors.grabbing] - The grabbing cursor to use when dragging a layer. May be any valid css cursor value.
	 * @param {String} [opts.cursors.move=Canvas.cursors.move] - The default cursor to use when hovering over a resize anchor. May be any valid css cursor value.
	 * @param {String} [opts.cursors.rotate=Canvas.cursors.rotate] - The default cursor to use when hovering a rotate anchor point. May be any valid css cursor value.
	 * @param {String} [opts.cursors.rotating=Canvas.cursors.rotating] - The default cursor to use when rotating an active layer. May be any valid css cursor value.
	 * @returns {Canvas}
	 */
	constructor(canvas, opts={}){
		this.canvas = canvas;
		this.width = canvas.width;
		this.height = canvas.height;
		this.ctx = canvas.getContext('2d');
		this.layers = [];
		this.layer_state_pos = -1;
		this.layer_states = [];
		this.activeLayer = null;
		this.shiftKeyDown = false;
		this.draggingActiveLayer = false;
		this.resizingActiveLayer = false;
		this.rotatingActiveLayer = false;
		this.lastMouseDownOffset = {x:0, y:0};
		this.activeLayerMouseOffset = {x:0, y:0};
		this.activeLayerOriginalDimensions = {width:0, height:0};
		this.activeLayerRotateStartPos = {x:0, y:0};
		this.displayGrid = false;
		this.snapToGrid = false;
		this.gridDistancePixels = 10;
		canvas.addEventListener('mousemove', this.onmousemove.bind(this));
		canvas.addEventListener('mousedown', this.onmousedown.bind(this));
		canvas.addEventListener('mouseout', this.onmousereset.bind(this));
		canvas.addEventListener('mouseup', this.onmousereset.bind(this));
		canvas.addEventListener('click', this.onclick.bind(this));
		canvas.addEventListener('dblclick', this.ondblclick.bind(this));
		document.addEventListener('keydown', this.onkeyevent.bind(this));
		document.addEventListener('keyup', this.onkeyevent.bind(this));
		
		this.anchorRadius = opts.anchorRadius || Canvas.anchorRadius;
		this.strokeStyle = opts.strokeStyle || Canvas.strokeStyle;
		this.fillStyle = opts.fillStyle || Canvas.fillStyle;
		this.lineWidth = opts.lineWidth || Canvas.lineWidth;
		this.cursors = opts.cursors || {};
		this.cursors.default = this.cursors.default || Canvas.cursors.default;
		this.cursors.grab = this.cursors.grab || Canvas.cursors.grab;
		this.cursors.grabbing = this.cursors.grabbing || Canvas.cursors.grabbing;
		this.cursors.move = this.cursors.move || Canvas.cursors.move;
		this.cursors.rotate = this.cursors.rotate || Canvas.cursors.rotate;
		this.cursors.rotating = this.cursors.rotating || Canvas.cursors.rotating;
		this.last_clicked_layer = null;
		this.pending_layers = 0;
		this.ready = true;
	}	
	
	/**
	 * Load the state object
	 * @param {type} state
	 * @returns {undefined}
	 */
	loadState(state){
		this.layers = state.map(s=>CanvasLayer.deobjectify(s));
		this.draggingActiveLayer = false;
		this.resizingActiveLayer = false;
		this.rotatingActiveLayer = false;
		this.lastMouseDownOffset = {x:0, y:0};
		this.activeLayerMouseOffset = {x:0, y:0};
		this.activeLayerOriginalDimensions = {width:0, height:0};
		this.activeLayerRotateStartPos = {x:0, y:0};
		this.draw();
	}
	
	/**
	 * saves the current state in the state stack
	 * @returns {undefined}
	 */
	saveState(){
		var state = this.layers.map(l=>l.objectify());
		this.layer_states.length = this.layer_state_pos+1;
		this.layer_states.push(state);
		this.layer_state_pos = this.layer_states.length-1;
	}
	
	/**
	 * Undo an action
	 * @returns {undefined}
	 */
	undo(){
		if(this.layer_state_pos>0){
			this.layer_state_pos--;
			this.loadState(this.layer_states[this.layer_state_pos]);
		}
	}
	
	/**
	 * Redo the last un-did action
	 * @returns {undefined}
	 */
	redo(){
		if((this.layer_state_pos+1)<this.layer_states.length){
			this.layer_state_pos++;
			this.loadState(this.layer_states[this.layer_state_pos]);
		}
	}
	
	/**
	 * Enable snap to grid
	 * @returns {undefined}
	 */
	snapOn(gridDistancePixels=10){
		this.snapToGrid = true;
		gridDistancePixels = +gridDistancePixels < 3 ? 3 : +gridDistancePixels;
		this.gridDistancePixels = gridDistancePixels;
	}
	
	/**
	 * Disable snap to grid
	 * @returns {undefined}
	 */
	snapOff(){
		this.snapToGrid = false;
		this.draw();
	}
	
	/**
	 * Show the grid lines on the canvas
	 * @returns {undefined}
	 */
	showGrid(gridDistancePixels=10){
		this.displayGrid = true;
		gridDistancePixels = +gridDistancePixels < 3 ? 3 : +gridDistancePixels;
		this.gridDistancePixels = gridDistancePixels;
		this.draw();
	}
	
	/**
	 * Hide the grid lines on the canvas
	 * @returns {undefined}
	 */
	hideGrid(){
		this.displayGrid = false;
		this.draw();
	}
	
	/**
	 * Get a layer by it's given name.
	 * @param {String} name - The name of the layer. 
	 * @returns {CanvasLayer|null}
	 */
	getLayerByName(name){
		for(var i=this.layers.length; i--;){
			if(this.layers[i].name === name) return this.layers[i];
		}
		return null;
	}
	
	/**
	 * Add a layer to the canvas.
	 * @param {String} url - The URI or URL of an image to draw on the canvas.
	 * @param {String} [opts.name="Layer n"] - The name of the layer.
	 * @param {Number} [opts.x=this.width/2] - The x position of the layer.
	 * @param {Number} [opts.y=this.height/2] - The y position of the layer.
	 * @param {Number} [opts.rotation=0] - The rotation of the layer, counter-clockwise, in degrees.
	 * @param {Boolean} [opts.draggable=true] - Can the user move this layer?
	 * @param {Boolean} [opts.rotateable=true] - Can the user rotate this layer?
	 * @param {Boolean} [opts.resizable=true] - Can the user resize this layer?
	 * @param {Boolean} [opts.selectable=true] - Can the user select this layer?
	 * @param {Number} [opts.width=null] - The width of the layer to be drawn. If not specified, defaults to the images natural width.
	 * @param {Number} [opts.height=null] - The height of the layer to be drawn. If not specified, defaults to the images natural height.
	 * @param {Boolean} [opts.forceBoundary=false] - Force the item to stay in bounds.
	 * @returns {CanvasLayer} - The layer that was added.
	 */
	addLayer(layerOrURL, opts={}){
		this.ready = false;
		if(layerOrURL instanceof CanvasLayer){
			var layer = layerOrURL;
		}else{
			const name = opts.name || `Layer ${this.layers.length}`;
			const x = parseFloat(opts.x || this.width/2);
			const y = parseFloat(opts.y || this.height/2);
			const rotation = parseFloat(opts.rotation || 0);
			const draggable = opts.draggable === undefined ? true : opts.draggable;
			const rotateable = !!opts.rotateable === undefined ? true : opts.rotateable;
			const resizable = !!opts.resizable === undefined ? true : opts.resizable;
			const selectable = !!opts.selectable === undefined ? true : opts.selectable;
			const width = opts.width || null;
			const height = opts.height || null;
			const forceBoundary = opts.forceBoundary || false;
			var layer = new CanvasLayer(layerOrURL, name, x, y, width, height, rotation, draggable, rotateable, resizable, selectable, forceBoundary);
		}
		
		this.layers.unshift(layer);
		this.pending_layers++;
		layer.onload(()=>{
			this.pending_layers--;
			if(0 === this.pending_layers){
				this.ready = true;
				this.draw();
				this.saveState();
			}
		});
		return layer;
	}
	
	/**
	 * Rotate and crop the canvas to the dimensions and rotation of the specified layer.
	 * @param {CanvasLayer} layer - The layer to crop to.
	 * @returns {Promise} - A Promise htat resolves with the DataURI of the cropped area.
	 */
	cropToLayer(layer, unrotated=true){
		return this.extractPortion(layer.x, layer.y, layer.width, layer.height, layer.rotation, unrotated);
	}
	
	/**
	 * Rotate and extract a custom area of the canvas.
	 * @param {Number} centerx - The x position of the center of the area to extract.
	 * @param {Number} centery - The y position of the center of the area to extract.
	 * @param {Number} width - The width of the area to extract from teh canvas.
	 * @param {Number} height - The height of the area to extract from teh canvas.
	 * @param {Number} [rotation=0] - The rotation of the area to extract, counter-clockwise, in degrees.
	 * @param {Boolean} [unrotated=true] - If true, undo the rotation so the layer is in it's natural position.
	 * @returns {Promise} - A Promise htat resolves with the DataURI of the cropped area.
	 */
	async extractPortion(centerx, centery, width, height, rotation=0, unrotated=true){
		var radians = rotation * Math.PI / 180;
		var {x, y} = Canvas.absolutePoint(-(width/2), -(height/2), centerx, centery, rotation);
		
		var rectBB = this.getRotatedRectBB(x, y, width, height, radians);
		
		var canvas0 = document.createElement("canvas");
		var ctx0 = canvas0.getContext("2d");
		var canvas1 = document.createElement("canvas");
		var ctx1 = canvas1.getContext("2d");
		var canvas2 = document.createElement("canvas");
		var ctx2 = canvas2.getContext("2d");
		
		canvas1.width = canvas2.width = rectBB.width;
		canvas1.height = canvas2.height = rectBB.height;
		canvas0.width = this.width;
		canvas0.height = this.height;
		
		await this.loadAll();
		
		for(let i=this.layers.length; i--;){
			let layer = this.layers[i];
			var radians = layer.rotation * (Math.PI/180);
			ctx0.translate(layer.x, layer.y);
			ctx0.rotate(radians);
			ctx0.drawImage(layer.image, -(layer.width/2), -(layer.height/2), layer.width, layer.height);
			ctx0.rotate(-radians);
			ctx0.translate(-layer.x, -layer.y);
		}

		ctx1.drawImage(canvas0, rectBB.cx - rectBB.width / 2, rectBB.cy - rectBB.height / 2, rectBB.width, rectBB.height, 0, 0, rectBB.width, rectBB.height);
		
		if(!unrotated){
			return canvas1.toDataURL();
		}
		
		ctx2.translate(canvas1.width / 2, canvas1.height / 2);
		ctx2.rotate(-radians);
		ctx2.drawImage(canvas1, -canvas1.width / 2, -canvas1.height / 2);
		var ofstx = (canvas2.width - width) / 2;
		var ofsty = (canvas2.height - height) / 2;
		ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
		canvas1.width = width;
		canvas1.height = height;
		ctx1.drawImage(canvas2, -ofstx, -ofsty);
		return canvas1.toDataURL();
	}
	
	
	/**
	 * Draw the canvas.
	 * @returns {undefined}
	 */
	draw(){
		if(!this.ready) return;
			
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		for(let i=this.layers.length; i--;){
			let layer = this.layers[i];
			var radians = layer.rotation * (Math.PI/180);
			this.ctx.translate(layer.x, layer.y);
			this.ctx.rotate(radians);
			
			this.ctx.drawImage(layer.image, -(layer.width/2), -(layer.height/2), layer.width, layer.height);
			
			if(layer === this.activeLayer){
				this.ctx.strokeStyle = this.strokeStyle;
				this.ctx.fillStyle = this.fillStyle;
				this.ctx.lineWidth = this.getScale() * this.lineWidth;
				this.ctx.strokeRect(-(layer.width/2), -(layer.height/2), layer.width, layer.height);
				if(layer.resizable){
					layer.getCorners().forEach(corner=>{
						this.drawCircle(corner.x, corner.y, this.getScale() * this.anchorRadius);
					});
				}
				if(layer.rotateable){
					this.ctx.beginPath();
					this.ctx.moveTo(0, 0);
					this.ctx.lineTo((layer.width/2)+25, 0);
					this.ctx.stroke();
					this.drawCircle((layer.width/2)+25, 0, this.getScale() * this.anchorRadius);
				}
			}
			this.ctx.rotate(-radians);
			this.ctx.translate(-layer.x, -layer.y);
		}
		
		if(this.displayGrid){
			this.ctx.strokeStyle = "rgba(0,0,0,0.2)";
			this.ctx.lineWidth = this.getScale() * 2;
			var {xs, ys} = this.getGridLines(false);
			xs.forEach(x=>{
				this.ctx.beginPath();
				this.ctx.moveTo(x, 0);
				this.ctx.lineTo(x, this.canvas.height);
				this.ctx.stroke(); 
			});
			ys.forEach(y=>{
				this.ctx.beginPath();
				this.ctx.moveTo(0, y);
				this.ctx.lineTo(this.canvas.width, y);
				this.ctx.stroke(); 
			});
		}
	}	
	
	/**
	 * Remove all layers from teh canvas.
	 * @returns {undefined}
	 */
	removeAllLayers(){
		this.deSelectLayer();
		this.layers = [];
		this.draw();
	}
	
	/**
	 * Remove the specified layer from the canvas.
	 * @param {CanvasLayer} layer - The layer to remove
	 * @returns {undefined}
	 */
	removeLayer(layer){
		if(layer === this.activeLayer) this.deSelectLayer();
		this.layers.splice(this.layers.indexOf(layer), 1);
		this.saveState();
		this.draw();
	}
	
	/**
	 * Select the given layer.
	 * @param {CanvasLayer} layer - The layer to select.
	 * @returns {undefined}
	 */
	selectLayer(layer){
		this.layers.unshift(this.layers.splice(this.layers.indexOf(layer), 1)[0]);
		this.activeLayer = layer;
		this.draw();
		this.fireEvent('layer-selected');
	}
	
	/**
	 * Deselect the selected layer if one is selected.
	 * @returns {undefined}
	 */
	deSelectLayer(){
		this.activeLayer = null;
		this.draggingActiveLayer = false;
		this.draw();
		this.fireEvent('layer-deselected');
	}
	
	/**
	 * Get the cooresponding coordinates of the mouses position on the canvas.
	 * @param {MouseEvent} e - The event passed to a mouse event handler.
	 * @returns {{x: Number, y: Number}}
	 */
	canvasMousePos(e) {
		var rect = this.canvas.getBoundingClientRect();
		var x = e.clientX - rect.left;
		var y = e.clientY - rect.top;
		var wfactor = this.canvas.width / rect.width;
		var hfactor = this.canvas.height / rect.height;
		x = x*wfactor;
		y = y*hfactor;
		return {x, y};
	}
	
	/**
	 * Get the layer at the given canvas coordinates.
	 * @param {Number} x - The x ordinate.
	 * @param {Number} y - The y ordinate.
	 * @returns {CanvasLayer|null}
	 */
	getLayerAt(x, y){
		for(let i=0; i<this.layers.length; i++){
			let layer = this.layers[i];
			if(Canvas.isOverLayer(x, y, layer)) return layer;
		}
		return null;
	}
	
	/**
	 * Are the given coordinates over a selectable layer?
	 * @param {Number} x - The x ordinate.
	 * @param {Number} y - The y ordinate.
	 * @returns {Boolean}
	 */
	isOverSelectableLayer(x, y){
		for(let i=this.layers.length; i--;){
			if(Canvas.isOverLayer(x, y, this.layers[i])){
				if(this.layers[i].selectable && this.activeLayer !== this.layers[i]) return true;
			}
		}
		return false;
	}
	
	////////////////////////////////////////////////////////////////////////////
	// Undocumented utility layers /////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Get an object containing arrays of x and y grid line positons
	 * @param {Boolean} snap - If true, get lines to snap to, else get lines to display
	 * @returns {Object} - An object with an 'xs' property containing x positions and a 'ys' property containing y positions;
	 */
	getGridLines(snap=true){
		var xs = [];
		var ys = [];
		var dist = 0;
		
		if(snap){
			dist = this.gridDistancePixels;
		}else{
			dist = this.gridDistancePixels * 2;
		}
		
		for(var x=0; x<this.canvas.width; x += (this.getScale() * dist)){
			xs.push(x); 
		}
		for(var y=0; y<this.canvas.height; y += (this.getScale() * dist)){
			ys.push(y);
		}
		for(let i=this.layers.length; i--;){
			if(snap && this.layers[i] === this.activeLayer) continue;
			xs.push(this.layers[i].x);
			ys.push(this.layers[i].y);
		}
		[...new Set(xs)].sort();
		[...new Set(ys)].sort();
		return {xs, ys};
	}
	
	/**
	 * Load all layers.
	 * @ignore
	 */
	loadAll(){
		var promises = this.layers.map(layer=>layer.load());
		return Promise.all(promises);
	}
	
	/**
	 * Get the bounding box of the defined area.
	 * @ignore
	 */
	getRotatedRectBB(x, y, width, height, rAngle) {
		var absCos = Math.abs(Math.cos(rAngle));
		var absSin = Math.abs(Math.sin(rAngle));
		var cx = x + width / 2 * Math.cos(rAngle) - height / 2 * Math.sin(rAngle);
		var cy = y + width / 2 * Math.sin(rAngle) + height / 2 * Math.cos(rAngle);
		var w = width * absCos + height * absSin;
		var h = width * absSin + height * absCos;
		return ({
			cx: cx,
			cy: cy,
			width: w,
			height: h
		});
	}
	
	/**
	 * Draw a circle on the canvas.
	 * @ignore
	 */
	drawCircle(x, y, radius){
		this.ctx.beginPath();
		this.ctx.arc(x, y, radius, 0, Math.PI*2, true); 
		this.ctx.closePath();
		this.ctx.fill();
	}
	
	/**
	 * Handle key down and keyup.
	 * @ignore
	 */
	onkeyevent(e){
		this.shiftKeyDown = e.shiftKey;
	}
	
	/**
	 * Handle mouse moves over the canvas.
	 * @ignore
	 */
	onmousemove(e){
		var {x, y} = this.canvasMousePos(e);
		this.setCursor(x, y);
		if(this.activeLayer === null) return;
		
		if(this.rotatingActiveLayer){
			if(this.fireEvent('layer-rotate')){
				var dx = x - this.activeLayer.x;
				var dy = y - this.activeLayer.y;
				var angle = Math.atan2(dy, dx);
				var degrees = angle * 180 / Math.PI;
				this.activeLayer.rotation = degrees;
				if(this.activeLayer instanceof CanvasLayerGroup){
					this.activeLayer.updateLayers();
				}
				this.draw();
			}
		}else if(this.draggingActiveLayer){
			const newx = this.activeLayerMouseOffset.x + x;
			const newy = this.activeLayerMouseOffset.y + y;
			
			if(this.activeLayer.forceBoundary && !this.isNewPosInBounds(this.activeLayer, newx, newy, this.activeLayer.width, this.activeLayer.height)){
				this.draggingActiveLayer = false;
				this.draw();
				return;
			}
			
			if(this.fireEvent('layer-drag')){
				
				var moveRightPixels = newx - this.activeLayer.x;
				var moveDownPixels = newy - this.activeLayer.y;
				
				this.activeLayer.x += moveRightPixels;
				this.activeLayer.y += moveDownPixels;
				
				if(this.activeLayer instanceof CanvasLayerGroup){
					this.activeLayer.updateLayers();
				}
				
				this.draw();
			}
		}else if(this.resizingActiveLayer){
			
			const {width, height} = this.calculateLayerResize(x, y);
			if(this.activeLayer.forceBoundary && !this.isNewPosInBounds(this.activeLayer, this.activeLayer.x, this.activeLayer.y, width, height)){
				this.draggingActiveLayer = false;
				this.draw();
				return;
			}
			
			if(this.fireEvent('layer-resize')){
				this.activeLayer.width = width;
				this.activeLayer.height = height;
				
				if(this.activeLayer instanceof CanvasLayerGroup){
					this.activeLayer.updateLayers();
				}
				
				this.draw();
			}
		}
	}
	
	/**
	 * Set the appropriate cursor.
	 * @ignore
	 */
	setCursor(x, y){
		if(this.rotatingActiveLayer){
			document.body.style.cursor = this.cursors.rotating;
		}else if(this.draggingActiveLayer){
			document.body.style.cursor = this.cursors.grabbing;
		}else if(this.resizingActiveLayer){
			document.body.style.cursor = this.cursors.move;
		}else if(this.isNearActiveCorner(x, y)){
			document.body.style.cursor = this.cursors.move;
		}else if(this.isNearActiveRotatePoint(x, y)){
			document.body.style.cursor = this.cursors.rotate;
		}else if(this.isOverSelectableLayer(x, y)){
			document.body.style.cursor = this.cursors.grab;
		}else{
			document.body.style.cursor = this.cursors.default;
		}
	}
	
	/**
	 * Calculate new width and height of resizing image
	 * @ignore
	 */
	calculateLayerResize(x, y){
		var width = this.activeLayer.width;
		var height = this.activeLayer.height;
		
		var o = this.lastMouseDownOffset;
		var n = Canvas.layerRelativePoint(x, y, this.activeLayer);
		if(o.x > 0){
			width = Math.abs(this.activeLayerOriginalDimensions.width - (o.x-n.x)*2);
		}else{
			width = Math.abs(this.activeLayerOriginalDimensions.width - (n.x-o.x)*2);
		}
		if(o.y > 0){
			height = Math.abs(this.activeLayerOriginalDimensions.height - (o.y-n.y)*2);
		}else{
			height = Math.abs(this.activeLayerOriginalDimensions.height - (n.y-o.y)*2);
		}
		if(this.shiftKeyDown){
			var ratio = Math.min(
				width/this.activeLayerOriginalDimensions.width, 
				height/this.activeLayerOriginalDimensions.height
			);
			width = this.activeLayerOriginalDimensions.width * ratio;
			height = this.activeLayerOriginalDimensions.height * ratio;
		}
		
		return {width, height};
	}
	
	/**
	 * Fire an event.
	 * @ignore
	 */
	fireEvent(type){
		var event = new CustomEvent(type, {detail: this, cancelable: true, bubbles: true});
		return this.canvas.dispatchEvent(event);
	}
	
	/**
	 * Listen for click event on a layer
	 * @ignore
	 */
	onclick(e){
		var {x, y} = this.canvasMousePos(e);
		var lcl = this.getLayerAt(x, y);
		if(lcl){
			this.last_clicked_layer = lcl;
			this.fireEvent('layer-click');
		}
	}
	
	/**
	 * Listen for dbl click event on a layer
	 * @ignore
	 */
	ondblclick(e){
		var {x, y} = this.canvasMousePos(e);
		var lcl = this.getLayerAt(x, y);
		if(lcl){
			this.last_clicked_layer = lcl;
			this.fireEvent('layer-dblclick');
		}
	}
	
	/**
	 * Handle mousedown over the canvas.
	 * @ignore
	 */
	onmousedown(e){
		var {x, y} = this.canvasMousePos(e);
		this.setCursor(x, y);
		if(this.isNearActiveRotatePoint(x, y)){
			this.activeLayerRotateStartPos = {x, y};
			this.rotatingActiveLayer = true;
		}else if(this.isNearActiveCorner(x, y)){
			this.resizingActiveLayer = true;
		}else{
			var cancelled = false;
			var layer = this.getLayerAt(x, y);
			if(layer !== null && layer.selectable === false) layer = null;
			if(layer !== null && this.activeLayer !== null && layer !== this.activeLayer){
				cancelled = !this.fireEvent('layer-deselect');
				if(!cancelled) !this.deSelectLayer();
			}
			if(!cancelled && layer !== null){
				this.activeLayerMouseOffset.x = layer.x - x;
				this.activeLayerMouseOffset.y = layer.y - y;
				if(layer.draggable) this.draggingActiveLayer = true;
				if(layer !== this.activeLayer){
					if(this.fireEvent('layer-select')){
						this.selectLayer(layer);
					}
				}
			}
		}
		if(this.activeLayer){
			this.activeLayerOriginalDimensions = {
				width: this.activeLayer.width,
				height: this.activeLayer.height
			};
			this.lastMouseDownOffset = Canvas.layerRelativePoint(x, y, this.activeLayer);
		}
	}
	
	/**
	 * Are teh given coordinates near an active rotate anchor.
	 * @ignore
	 */
	isNearActiveRotatePoint(x, y){
		if(!this.activeLayer || !this.activeLayer.rotateable) return false;
		var {x, y} = Canvas.layerRelativePoint(x, y, this.activeLayer);
		var mx = (this.activeLayer.width/2)+25;
		var my = 0;
		var dist = Math.hypot(mx-x, my-y);
		if(dist <= this.getScale() * this.anchorRadius) return true;
		return false;
	}
	
	/**
	 * Are the given coordinates near an active resize anchor.
	 * @ignore
	 */
	isNearActiveCorner(x, y){
		if(!this.activeLayer || !this.activeLayer.resizable) return false;
		var {x, y} = Canvas.layerRelativePoint(x, y, this.activeLayer);
		var isNear = false;
		this.activeLayer.getCorners().forEach(corner=>{			
			var dist = Math.hypot(corner.x-x, corner.y-y);
			if(dist <= this.getScale() * this.anchorRadius) isNear = true;
		});
		return isNear;
	}
	
	/**
	 * Given a position, check if it is in bounds
	 * @ignore
	 */
	isNewPosInBounds(layer, x, y, width, height){
		var _x = layer.x;
		var _y = layer.y;
		var _width = layer.width;
		var _height = layer.height;
		
		layer.x = x;
		layer.y = y;
		layer.width = width;
		layer.height = height;
		
		var inbounds = true;
		layer.getCorners().forEach(corner=>{
			var pos = Canvas.absolutePoint(corner.x, corner.y, layer.x, layer.y, layer.rotation);
			if(pos.x < 0 || pos.x > this.width || pos.y < 0 || pos.y > this.width){
				inbounds = false;
			}
		});
		layer.x = _x;
		layer.y = _y;
		layer.width = _width;
		layer.height = _height;
		return inbounds;
	}
	
	/**
	 * Get nearest grid line
	 * @ignore
	 */
	getNearestGridline(n, grid){
		return Object.values(grid.reduce((acc, val)=>{
			if(val > n){
				if(null === acc.high) acc.high = val;
				else acc.high = Math.min(acc.high, val);
			}else{
				if(null === acc.low) acc.low = val;
				else acc.low = Math.max(acc.low, val);
			}
			return acc;
		}, {low: null, high: null})).reduce((acc, val)=>{
			var valDistToN = Math.abs(val - n);
			var accDistToN = acc === null ? null : Math.abs(acc - n);
			if(acc === null || valDistToN < accDistToN) acc = val;
			return acc;
		}, null);
	}
	
	/**
	 * Handle mouseup or mouseout.
	 * @ignore
	 */
	onmousereset(e){
		if(this.draggingActiveLayer && this.snapToGrid && this.activeLayer){
			var {xs, ys} = this.getGridLines();
			var closestx = this.getNearestGridline(this.activeLayer.x, xs);
			var closesty = this.getNearestGridline(this.activeLayer.y, ys);
			var redraw_required = false;
			var dist = Math.abs(closestx - this.activeLayer.x);
			if(dist <= this.gridDistancePixels && dist !== 0){
				this.activeLayer.x = closestx;
				redraw_required = true;
			}
			dist = Math.abs(closesty - this.activeLayer.y);
			if(dist <= this.gridDistancePixels && dist !== 0){
				this.activeLayer.y = closesty;
				redraw_required = true;
			}
			if(redraw_required){
				this.draw();
			}
		}
		if(this.draggingActiveLayer || this.resizingActiveLayer || this.rotatingActiveLayer) this.saveState();
		var {x, y} = this.canvasMousePos(e);
		this.draggingActiveLayer = false;
		this.resizingActiveLayer = false;
		this.rotatingActiveLayer = false;
		this.lastMouseDownOffset = {x:0, y:0};
		this.activeLayerMouseOffset = {x:0, y:0};
		this.activeLayerOriginalDimensions = {width:0, height:0};
		this.activeLayerRotateStartPos = {x:0, y:0};
		this.setCursor(x, y);
	}
	
	/**
	 * Get the scale of the canvas
	 * @ignore
	 */
	getScale(){
		var rect = this.canvas.getBoundingClientRect();
		return this.canvas.width / rect.width;
	}
	
}

/**
 * The version of the library
 * @type {String}
 */
Canvas.version = '{{ VERSION }}';

/**
 * The default anchorRadius value for all Canvas instances.
 * @type {Number}
 */
Canvas.anchorRadius = 8;

/**
 * The default strokeStyle value for all Canvas instances.
 * @type {String}
 */
Canvas.strokeStyle = '#ba0000';

/**
 * The default fillStyle value for all Canvas instances.
 * @type {String}
 */
Canvas.fillStyle = 'black';

/**
 * The default lineWidth value for all Canvas instances.
 * @type {Number}
 */
Canvas.lineWidth = 5;

/**
 * The default Cursor values for all Canvas instances. See the canvas constructor for details.
 * @type {Object}
 * @property {String} Canvas.cursors.default
 * @property {String} Canvas.cursors.grab
 * @property {String} Canvas.cursors.grabbing
 * @property {String} Canvas.cursors.move
 * @property {String} Canvas.cursors.rotate
 * @property {String} Canvas.cursors.rotating
 */
Canvas.cursors = {
	default: null,
	grab: "grab",
	grabbing: "grabbing",
	move: "crosshair",
	rotate: "grab",
	rotating: "grabbing"
};


/**
 * Convert a relative point to an absolute point.
 * @ignore
 */
Canvas.absolutePoint = (relPointX, relPointY, centerX, centerY, rotationDegrees) => {
   var radians = rotationDegrees * (Math.PI / 180);
   var cos = Math.cos(radians);
   var sin = Math.sin(radians);
   var x = centerX + (relPointX * cos) - (relPointY * sin);
   var y = centerY + (relPointX * sin) + (relPointY * cos);
   return {x, y};
};

/**
 * Get the position of a point relative to another point and possibly rotated.
 * @ignore
 */
Canvas.relativePoint = (absPointX, absPointY, centerX, centerY, rotation) => {
   absPointX -= centerX;
   absPointY -= centerY;
   var radians = rotation * (Math.PI / 180);
   var cos = Math.cos(radians);
   var sin = Math.sin(radians);
   var x = (absPointX * cos) + (absPointY * sin);
   var y = (-absPointX * sin) + (absPointY * cos);
   x = Math.floor(x * 100) / 100;
   y = Math.floor(y * 100) / 100;
   return {x, y};
};

/**
 * Get the point relative to the center of a given layer.
 * @ignore
 */
Canvas.layerRelativePoint = (absPointX, absPointY, layer) => {
   return Canvas.relativePoint(absPointX, absPointY, layer.x, layer.y, layer.rotation);
};

/**
 * Are the given coordinates over the given layer?
 * @param {Number} x - The x ordinate.
 * @param {Number} y - The y ordinate.
 * @param {CanvasLayer} layer - The layer to check.
 * @returns {Boolean}
 */
Canvas.isOverLayer = (x, y, layer)=>{
	let r = Canvas.layerRelativePoint(x, y, layer);
	if(r.x > (layer.width/2)) return false;
	if(r.x < -(layer.width/2)) return false;
	if(r.y > (layer.height/2)) return false;
	if(r.y < -(layer.height/2)) return false;
	return true;
};