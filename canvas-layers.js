/**
 * canvas-layers - v2.1.77
 * Allow user to position and re-arrange images on a canvas.
 * @author Pamblam
 * @website 
 * @license MIT
 */


/**
 * Interface for handling all canvas functionality
 * @see https://pamblam.github.io/canvas-layers/examples/
 * @version 2.1.77
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
		this.drawPromises = [];
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
		
		// if turned on, no state will be saved.
		this.muteStateChanges = false;
		this.isCtrlPressed = false;
		this.ctrlGroupLayer = new CanvasLayerGroup('ctrl-grp');
	}	
	
	/**
	 * Is the provided layer part of the ctrl-grp
	 * @param {CavnasLayer} layer
	 * @returns {Boolean}
	 */
	isLayerInGroup(layer){
		return !!~this.ctrlGroupLayer.layers.indexOf(layer);
	}
	
	/**
	 * Is the ctrl-grp on the canvas?
	 * @returns {Boolean}
	 */
	isGroupOnCanvas(){ 
		return !!~this.layers.indexOf(this.ctrlGroupLayer) 
	}
	
	/**
	 * Remove the ctrl-grp from the canvas
	 * @returns {Promise}
	 */
	async destroyCtrlGroup(){
		this.muteStateChanges = true;
		var promises = this.ctrlGroupLayer.layers.map(layer=>{
			return new Promise(done=>{
				this.addLayer(layer);
				layer.onload(()=>done());
			});
		});
		await Promise.all(promises);
		this.ctrlGroupLayer.layers = [];
		this.ctrlGroupLayer.rotation = 0;
		if(this.isGroupOnCanvas()) this.removeLayer(this.ctrlGroupLayer);
		this.muteStateChanges = false;
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
		if(this.muteStateChanges) return;
		var state = [];
		const getState = (layers) => {
			layers.forEach(layer=>{
				if(layer instanceof CanvasLayerGroup) getState(layer.layers);
				else state.push(layer.objectify());
			});
		}
		getState(this.layers);
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
	 * @param {Boolean} [opts.allowOverlap=true] - Allow layers to overlap with this one.
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
			const allowOverlap = opts.hasOwnProperty('allowOverlap') ? !!opts.allowOverlap : true;
			var layer = new CanvasLayer(layerOrURL, name, x, y, width, height, rotation, draggable, rotateable, resizable, selectable, forceBoundary, allowOverlap);
		}
		
		this.layers.unshift(layer);
		this.pending_layers++;
		
		layer.onload(()=>{
			this.pending_layers--;
			if(0 === this.pending_layers){
				this.ready = true;
				this.draw();
				this.saveState();
				
				if(!(layer instanceof CanvasLayerGroup)){
					this.fireEvent('layer-added');
				}
				
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
	 * @returns {Promise}
	 */
	draw(){
		return new Promise(done=>{
			this.drawPromises.push(done);
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
			
			while(this.drawPromises.length) this.drawPromises.shift()();
		});
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
	
	/**
	 * Get an array of all layers that the given layer overlaps.
	 * @param {type} layer
	 * @returns {Array|Canvas.getOverlappingLayers.layers}
	 */
	getOverlappingLayers(layer){
		var layers = [];
		for(var i=0; i<this.layers.length; i++){
			if(this.layers[i] === layer) continue;
			if(this.doLayersOverlap(layer, this.layers[i])){
				layers.push(this.layers[i]);
			}			
		}
		return layers;
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
		if('Shift' === e.key){
			if(e.type === 'keydown') this.shiftKeyDown = true;
			else this.shiftKeyDown = false
		}
		if('Control' === e.key){
			if(e.type === 'keydown') this.isCtrlPressed = true;
			else this.isCtrlPressed = false
		}
		if(!this.isCtrlPressed && this.isGroupOnCanvas()){
			this.destroyCtrlGroup();
		}
	}
	
	/**
	 * Check if two given layers overlap
	 * @param {CanvasLayer} layer1
	 * @param {CanvasLayer} layer2
	 * @returns {Boolean}
	 */
	doLayersOverlap(layer1, layer2){
		const abs_corners = l => l.getCorners().map(c=>Canvas.absolutePoint(c.x, c.y, l.x, l.y, l.rotation));
		const corners_to_lines = c => [
			[{x:c[0].x, y:c[0].y},{x:c[1].x, y:c[1].y}],
			[{x:c[1].x, y:c[1].y},{x:c[2].x, y:c[2].y}],
			[{x:c[2].x, y:c[2].y},{x:c[3].x, y:c[3].y}],
			[{x:c[3].x, y:c[3].y},{x:c[0].x, y:c[0].y}]
		];
		
		var l1_corners = abs_corners(layer1);
		var l1_lines = corners_to_lines(l1_corners);
		
		var l2_corners = abs_corners(layer2);
		var l2_lines = corners_to_lines(l2_corners);
		
		// Check if any of the edges intersect
		// This covers partial overlaps.
		for(let n1=0; n1<l1_lines.length; n1++){
			for(let n2=0; n2<l2_lines.length; n2++){
				let a = l1_lines[n1][0].x;
				let b = l1_lines[n1][0].y;
				let c = l1_lines[n1][1].x;
				let d = l1_lines[n1][1].y;
				let p = l2_lines[n2][0].x;
				let q = l2_lines[n2][0].y;
				let r = l2_lines[n2][1].x;
				let s = l2_lines[n2][1].y;
				if(Canvas.doLinesIntersect(a, b, c, d, p, q, r, s)) return true;
			}
		}
		
		// Check for one corner. This covers full overlaps.
		var c1 = layer1.getCorners()[0];
		c1 = Canvas.absolutePoint(c1.x, c1.y, layer1.x, layer1.y, layer1.rotation);
		if(Canvas.isOverLayer(c1.x, c1.y, layer2)) return true;
		
		var c2 = layer2.getCorners()[0];
		c2 = Canvas.absolutePoint(c2.x, c2.y, layer2.x, layer2.y, layer2.rotation);
		if(Canvas.isOverLayer(c2.x, c2.y, layer1)) return true;
		
		return false;
	}
	
	/**
	 * Returns true if the active layer can be moved to the specified coordinates.
	 * @ignore
	 */
	canMoveActiveLayer(newx, newy){
		const inBounds = this.isNewPosInBounds(this.activeLayer, newx, newy, this.activeLayer.width, this.activeLayer.height);
		if(this.activeLayer.forceBoundary && !inBounds) return false;
		
		var x = this.activeLayer.x;
		var y = this.activeLayer.y;
		this.activeLayer.x = newx;
		this.activeLayer.y = newy;
		
		var canMove = true;
		for(var i=0; i<this.layers.length; i++){
			if(this.layers[i] === this.activeLayer) continue;
			if(this.activeLayer.allowOverlap && this.layers[i].allowOverlap) continue;
			if(this.doLayersOverlap(this.activeLayer, this.layers[i])){
				canMove = false;
				break;
			}
		}
		
		this.activeLayer.x = x;
		this.activeLayer.y = y;
		
		return canMove;
	}
	
	/**
	 * Returns true if the active layer can be resized to the specified dimensions.
	 * @ignore
	 */
	canResizeActiveLayer(width, height){
		const inBounds = this.isNewPosInBounds(this.activeLayer, this.activeLayer.x, this.activeLayer.y, width, height);
		if(this.activeLayer.forceBoundary && !inBounds) return false;
		
		var w = this.activeLayer.width;
		var h = this.activeLayer.height;
		this.activeLayer.width = w;
		this.activeLayer.height = h;
		
		var canResize = true;
		for(var i=0; i<this.layers.length; i++){
			if(this.layers[i] === this.activeLayer) continue;
			if(this.activeLayer.allowOverlap && this.layers[i].allowOverlap) continue;
			if(this.doLayersOverlap(this.activeLayer, this.layers[i])){
				canResize = false;
				break;
			}
		}
		
		this.activeLayer.width = w;
		this.activeLayer.height = h;
		
		return canResize;
	}
	
	/**
	 * Returns true if the active layer can be rotated to the specified degree.
	 * @ignore
	 */
	canRotateActiveLayer(degrees){
		var r = this.activeLayer.rotation;
		this.activeLayer.rotation = degrees;
		
		const inBounds = this.isNewPosInBounds(this.activeLayer, this.activeLayer.x, this.activeLayer.y, this.activeLayer.width, this.activeLayer.height);
		if(this.activeLayer.forceBoundary && !inBounds) return false;
		
		var canRotate = true;
		for(var i=0; i<this.layers.length; i++){
			if(this.layers[i] === this.activeLayer) continue;
			if(this.activeLayer.allowOverlap && this.layers[i].allowOverlap) continue;
			if(this.doLayersOverlap(this.activeLayer, this.layers[i])){
				canRotate = false;
				break;
			}
		}
		
		this.activeLayer.rotation = r;
		
		return canRotate;
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
			
			var dx = x - this.activeLayer.x;
			var dy = y - this.activeLayer.y;
			var angle = Math.atan2(dy, dx);
			var degrees = angle * 180 / Math.PI;
			
			if(!this.canRotateActiveLayer(degrees)){
				this.rotatingActiveLayer = false;
				this.draw();
				return;
			}
			
			if(this.fireEvent('layer-rotate')){
				this.activeLayer.rotation = degrees;
				if(this.activeLayer instanceof CanvasLayerGroup){
					this.activeLayer.updateLayers();
				}
				this.draw();
			}
		}else if(this.draggingActiveLayer){
			const newx = this.activeLayerMouseOffset.x + x;
			const newy = this.activeLayerMouseOffset.y + y;
			
			if(!this.canMoveActiveLayer(newx, newy)){
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
			if(!this.canResizeActiveLayer(width, height)){
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
	async onmousedown(e){
		var {x, y} = this.canvasMousePos(e);
		this.setCursor(x, y);
		if(this.isNearActiveRotatePoint(x, y)){
			if(this.fireEvent('layer-rotate-start')){
				this.activeLayerRotateStartPos = {x, y};
				this.rotatingActiveLayer = true;
			}
		}else if(this.isNearActiveCorner(x, y)){
			if(this.fireEvent('layer-resize-start')){
				this.resizingActiveLayer = true;
			}
		}else{
			var cancelled = false;
			var layer = this.getLayerAt(x, y);
			if(layer !== null && layer.selectable === false) layer = null;
			if(layer !== null && this.activeLayer !== null && layer !== this.activeLayer){
				cancelled = !this.fireEvent('layer-deselect');
				if(!cancelled) !this.deSelectLayer();
			}
			if(!cancelled && layer !== null && this.fireEvent('layer-drag-start')){
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
		
		// Handling the grouping 
		var layer = this.getLayerAt(x, y);
		if(layer && layer !== this.ctrlGroupLayer && layer.selectable){
			if(!this.isCtrlPressed) this.destroyCtrlGroup();	
			if(!this.isLayerInGroup(layer)){
				this.muteStateChanges = true;
				await this.ctrlGroupLayer.addLayer(layer);
				if(this.ctrlGroupLayer.layers.length === 1) this.selectLayer(layer);
				layer.onload(()=>{
					this.muteStateChanges = false;
				});
			}
			if(!this.isGroupOnCanvas() && this.ctrlGroupLayer.layers.length > 1){
				this.muteStateChanges = true;
				this.ctrlGroupLayer.layers.forEach(l=>{
					this.removeLayer(l);
				});
				this.addLayer(this.ctrlGroupLayer);
				this.ctrlGroupLayer.onload(()=>{
					this.muteStateChanges = false;
				});
			}
			if(this.isGroupOnCanvas()){
				this.selectLayer(this.ctrlGroupLayer);
			}
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
		layer.getCorners().forEach(corner => {
			var pos = Canvas.absolutePoint(corner.x, corner.y, layer.x, layer.y, layer.rotation);
			if (pos.x < 0 || pos.x > this.width || pos.y < 0 || pos.y > this.width) {
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
		if(this.draggingActiveLayer) this.fireEvent("layer-drag-end");
		if(this.resizingActiveLayer) this.fireEvent("layer-resize-end");
		if(this.rotatingActiveLayer) this.fireEvent("layer-rotate-end");
		
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
Canvas.version = '2.1.77';

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
Canvas.isOverLayer = (x, y, layer) => {
	let r = Canvas.layerRelativePoint(x, y, layer);
	if(r.x > (layer.width/2)) return false;
	if(r.x < -(layer.width/2)) return false;
	if(r.y > (layer.height/2)) return false;
	if(r.y < -(layer.height/2)) return false;
	return true;
};

/**
 * returns true if the line from (a,b)->(c,d) intersects with (p,q)->(r,s)
 * @url https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
 * @returns {Boolean}
 */
Canvas.doLinesIntersect = (a,b,c,d,p,q,r,s) => {
	var det, gamma, lambda;
	det = (c - a) * (s - q) - (r - p) * (d - b);
	if (det === 0) {
		return false;
	} else {
		lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
		gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
		return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
	}
};

/**
 * Class representing the layers drawn on the canvas.
 */
class CanvasLayer{
	
	/**
	 * Create a new Layer.
	 * @param {String} url - The URL or URI of an image to draw on the canvas.
	 * @param {String} name - The name of the layer.
	 * @param {Number} x - The x position of the layer on the canvas.
	 * @param {Number} y - The y position of the layer on the canvas.
	 * @param {Number} [width=null] - The width of the layer on the canvas.
	 * @param {Number} [height=null] - The height of the layer on the canvas.
	 * @param {Number} [rotation=0] - The rotation of the layer on the canvas.
	 * @param {Boolean} [draggable=true] - Is the layer draggable?
	 * @param {Boolean} [rotateable=true] - Is the layer rotateable?
	 * @param {Boolean} [resizable=true] - Is the layer resizable?
	 * @param {Boolean} [selectable=true] - Is the layer selectable?
	 * @param {Boolean} [forceBoundary=false] - Force the layer to stay in bounds?
	 * @param {Boolean} [opts.allowOverlap=true] - Allow layers to overlap with this one.
	 * @returns {CanvasLayer}
	 */
	constructor(url, name, x, y, width=null, height=null, rotation=0, draggable=true, rotateable=true, resizable=true, selectable=true, forceBoundary=false, allowOverlap=true){
		this.name = name;
		this.url = url;
		this.ready = false;
		this.image = null;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.rotation = rotation;
		this.draggable = draggable;
		this.rotateable = rotateable;
		this.resizable = resizable;
		this.selectable = selectable;
		this.forceBoundary = forceBoundary;
		this.allowOverlap = allowOverlap;
		this.load_cb_stack = [];
		
		// Offset if in a for layer groups
		this.xoffset = 0;
		this.yoffset = 0;
		this.roffset = 0;
		this.owidth = 0;
		this.oheight = 0;
		
		this.properties = {};
		
		this.load();
		
	}
	
	/**
	 * jsonify the current layer
	 * @returns {String} - Serialized layer
	 */
	objectify(){
		return {
			layer: this, 
			state: {
				name: this.name,
				url: this.url,
				x: this.x,
				y: this.y,
				width: this.width,
				height: this.height,
				rotation: this.rotation,
				draggable: this.draggable,
				rotatable: this.rotateable,
				resizable: this.resizable,
				selectable: this.selectable,
				forceBoundary: this.forceBoundary,
				properties: this.properties
			}
		};
	}
	
	/**
	 * Register a function to be called when the layer is fully loaded.
	 * @param {Function} fn - The callback function.
	 * @returns {undefined}
	 */
	onload(fn){
		if(this.ready){
			fn();
			return;
		}else{
			this.load_cb_stack.push(fn);
		}
	}
	
	/**
	 * Load the layer so it is ready to use.
	 * @returns {Promise} - A promise that resolves when the layer is ready
	 */
	load(){
		return new Promise(done=>{
			if(this.ready){
				done();
			}else{
				const img = new Image();
				img.onload = ()=>{
					this.image = img;
					if(this.width===null) this.width = img.width;
					if(this.height===null) this.height = img.height;
					this.ready = true;
					this.load_cb_stack.forEach(fn=>fn());
					this.load_cb_stack = [];
					done();
				};
				img.src = this.url;
			}
		});
	}
	
	/**
	 * Get the relative position of all the corners.
	 * @ignore
	 */
	getCorners(){
		return [
			{x:-(this.width/2), y:-(this.height/2)},
			{x:-(this.width/2)+this.width, y:-(this.height/2)},
			{x:-(this.width/2)+this.width, y:-(this.height/2)+this.height},
			{x:-(this.width/2), y:-(this.height/2)+this.height}
		];
	}
	
}

/**
 * un Serialize a layer
 * @param {type} str
 * @returns {CanvasLayer}
 */
CanvasLayer.deobjectify = function(d){
	var layer = d.layer;
	Object.keys(d.state).forEach(key=>{
		layer[key] = d.state[key];
	});
	return layer;
};

/**
 * CavnasLayer that controls multiple layers
 */
class CanvasLayerGroup extends CanvasLayer{
	
	/**
	 * Create a new Layer.
	 * @param {String} name - The name of the layer.
	 * @param {Boolean} [draggable=true] - Is the layer draggable?
	 * @param {Boolean} [rotateable=true] - Is the layer rotateable?
	 * @param {Boolean} [resizable=true] - Is the layer resizable?
	 * @param {Boolean} [selectable=true] - Is the layer selectable?
	 * @param {Boolean} [forceBoundary=false] - Force the layer to stay in bounds?
	 * @returns {CanvasLayerGroup}
	 */
	constructor(name, draggable=true, rotateable=true, resizable=true, selectable=true, forceBoundary=false){
		var url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/1+yHgAHtAKYD9BncgAAAABJRU5ErkJggg==';
		super(url, name, 0, 0, 1, 1, 0, draggable, rotateable, resizable, selectable, forceBoundary);
		this.layers = [];
	}
	
	/**
	 * Get the layer on the given canvas at the given position. If this group 
	 * is selected it will return the layer in this group at the given 
	 * position, if applicatble.
	 * @param {Canvas} canvas - The Canvas element that owns the layers.
	 * @param {Number} x - The x position of the mouseclick relative to the canvas.
	 * @param {Number} y - The y position of the mouseclick relative to the canvas.
	 * @returns {layer|null}
	 */
	getLayerOrSubLayerAt(canvas, x, y){
		for(let i=0; i<canvas.layers.length; i++){
			
			let layer = canvas.layers[i];
			
			if(layer === this){
				for(let i=this.layers.length; i--;){
					let layer = this.layers[i];
					if(Canvas.isOverLayer(x, y, layer)) return layer;
				}
			}
			
			if(Canvas.isOverLayer(x, y, layer)) return layer;
		}
		return null;
	}
	
	/**
	 * Remove the provided layer from the group.
	 * @param {CanvasLayer} layer - The layer to remove.
	 * @returns {Promise}
	 */
	async removeLayer(layer){
		delete layer.xoffset;
		delete layer.yoffset;
		this.layers.splice(this.layers.indexOf(layer), 1);
		return await this.regenerate();
	}
	
	/**
	 * Add a layer to the group
	 * @param {CanvasLayer} layer - The layer to add.
	 * @returns {Promise}
	 */
	async addLayer(layer){
		if(layer === this) return;
		if(layer instanceof CanvasLayerGroup){
			this.layers.push(...layer.layers);
		}else{			
			this.layers.push(layer);
		}
		return await this.regenerate();
	}
	
	/**
	 * Regenerate images and dimensions.
	 * @ignore
	 */
	async regenerate(){
		var params = await this.getParams();
		
		this.width = this.owidth = params.width;
		this.height = this.oheight = params.height;
		
		this.x = params.x;
		this.y = params.y;
		this.rotation = 0;
		
		this.forceBoundary = params.forceBoundary;
		this.draggable =  params.draggable;
		this.rotateable =  params.rotateable;
		this.resizable =  params.resizable;
		this.selectable = params.selectable;
		
		this.url = params.uri;
		this.ready = false;
		return await this.load();
	}
	
	/**
	 * Update the sublayers of this group.
	 * @ignore
	 */
	updateLayers(){
		var ratiox = this.width/this.owidth;
		var ratioy = this.height/this.oheight;
		this.layers.forEach(layer=>{
			layer.width = layer.owidth * ratiox;
			layer.height = layer.oheight * ratioy;			
			layer.rotation = layer.roffset + this.rotation;
			var pos = Canvas.absolutePoint(layer.xoffset*ratiox, layer.yoffset*ratioy, this.x, this.y, this.rotation);
			layer.x = pos.x;
			layer.y = pos.y;
			
		});
	}
	
	/**
	 * Regenerate images and dimensions.
	 * @ignore
	 */
	async getParams(){
		const allCorners = this.layers.map(layer => {
			return layer.getCorners().map(corner=>{
				return Canvas.absolutePoint(corner.x, corner.y, layer.x, layer.y, layer.rotation);
			});
		});
		
		const allBounds = [];
		allCorners.forEach(corners=>{
			allBounds.push(...corners);
		});

		var pos = {
			left: allBounds.reduce((acc, cur)=>Math.min(acc, cur.x), Infinity),
			top: allBounds.reduce((acc, cur)=>Math.min(acc, cur.y), Infinity),
			right: allBounds.reduce((acc, cur)=>Math.max(acc, cur.x),0),
			bottom: allBounds.reduce((acc, cur)=>Math.max(acc, cur.y),0)
		};
		pos.width = pos.right - pos.left;
		pos.height = pos.bottom - pos.top;
		pos.x = pos.left+(pos.width/2);
		pos.y = pos.top+(pos.height/2);

		var ele = document.createElement('canvas');
		ele.width = pos.right+2;
		ele.height = pos.bottom+2;
		var canvas = new Canvas(ele);
		this.layers.forEach(layer=>canvas.addLayer(layer));
		
		pos.uri = await canvas.extractPortion(pos.x, pos.y, pos.width, pos.height, 0, false);
		
		pos.forceBoundary = this.layers.reduce((acc, itm)=>itm.forceBoundary||acc,false);
		pos.draggable = this.layers.reduce((acc, itm)=>acc===false?false:itm.draggable,true);
		pos.rotateable = this.layers.reduce((acc, itm)=>acc===false?false:itm.draggable,true);
		pos.resizable = this.layers.reduce((acc, itm)=>acc===false?false:itm.draggable,true);
		pos.selectable = this.layers.reduce((acc, itm)=>acc===false?false:itm.draggable,true);
		
		this.layers.forEach(l=>{
			l.xoffset = l.x - pos.x;
			l.yoffset = l.y - pos.y;
			l.roffset = l.rotation;
			l.owidth = l.width;
			l.oheight = l.height;
		});
		
		return pos;
	}

}

/**
 * Extention class that provides drawing abilities
 */
class DrawingCanvas extends Canvas{
	
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
		super(canvas, opts);
		
		// The current action....
		// one of... "rectangle", "ellipse", "line", "freehand"
		this.drawing_mode = null;
		
		// Styling options
		this.line_color = '#000000';
		this.fill_color = '#0000FF';
		
		// The x, y coords of the starting position of the current shape
		this.shape_start_pos = null;
		
		// Is the mouse button pressed?
		this.is_mouse_down = false;
		
		// An array of points that represents the current 
		// shape if the drawing mode is "freehand"
		this.freehand_coords = [];
		
		// An invisible canvas on which the user's input is rendered
		// This canvas is the same height and width as the original canvas
		this.rcanvas = document.createElement('canvas');
		this.rcanvas.height = this.height;
		this.rcanvas.width = this.width;
		this.rctx = this.rcanvas.getContext('2d');
		
		// As images are rendered on the rcanvas, they are copied to this canvas
		// and this canvas is resized and used to update the current active layer
		this.ccanvas = document.createElement('canvas');
		this.cctx = this.ccanvas.getContext('2d');
		
		// The layer that is being drawn via the above ccanvas
		this.drawing_layer = null;
		
		// dimensions of the current active layer as it's being created
		this.layer_dimensions = null;
		
	}
	
	/**
	 * Set the border or line width;
	 * @param {Number} width
	 * @returns {undefined}
	 */
	setLineWidth(width){
		this.rctx.lineWidth = +width;
	}
	
	/**
	 * Set the CSS color style of the border or line
	 * @param {string} style
	 * @returns {undefined}
	 */
	setStrokeStyle(style){
		this.rctx.strokeStyle = style;
	}
	
	/**
	 * Set the CSS color style background of the shape
	 * @param {string} style
	 * @returns {undefined}
	 */
	setFillStyle(style){
		this.rctx.fillStyle = style;
	}
	
	////////////////////////////////////////////////////////////////////////////
	// Helpers /////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////
	
	/**
	 * @ignore
	 * Helper function to draw a circle on a canvas
	 */
	drawEllipse(ctx, x, y, w, h) {
		var kappa = .5522848,
			ox = (w / 2) * kappa, // control point offset horizontal
			oy = (h / 2) * kappa, // control point offset vertical
			xe = x + w, // x-end
			ye = y + h, // y-end
			xm = x + w / 2, // x-middle
			ym = y + h / 2; // y-middle

		ctx.save();
		ctx.beginPath();
		ctx.moveTo(x, ym);
		ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
		ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
		ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
		ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}
	
	/**
	 * @ignore
	 * Copy the rcanvas image to the ccanvas and resize the ccanvas, then 
	 * create or update the current active layer
	 */
	renderLayer(){
		// Copy the rcavnas image to the canvas, crop it and render it to a dataURL
		var {x, y, width, height} = this.layer_dimensions;
		
		width += this.rctx.lineWidth * 2;
		height += this.rctx.lineWidth * 2;
		x -= this.rctx.lineWidth;
		y -= this.rctx.lineWidth;
		
		this.ccanvas.width = width;
		this.ccanvas.height = height;
		this.cctx.clearRect(0, 0, width, height);
		this.cctx.drawImage(this.rcanvas, x, y, width, height, 0, 0, width, height);
		var duri = this.ccanvas.toDataURL();
		
		// Get new layer center position
		const xpos = x + (width/2);
		const ypos = y + (height/2);
		
		if(!this.drawing_layer){
			// If there is not currently an active drawing layer, create it
			this.drawing_layer = this.addLayer(duri, {xpos, ypos});
		}else{
			// If there is an active layer, update the image and the 
			// dimensions and reload
			this.drawing_layer.x = xpos;
			this.drawing_layer.y = ypos;
			this.drawing_layer.width = width;
			this.drawing_layer.height = height;
			this.drawing_layer.url = duri;
			this.drawing_layer.ready = false;
			this.drawing_layer.image = null;
			this.drawing_layer.load().then(()=>this.draw());
		}
	}
	
	/**
	 * @ignore
	 * Update layer dimesions property (this.layer_dimensions) 
	 * of the active layer based on the user input 
	 */
	recalculateLayerDimensions(newMousePos){
		var x, y, width, height;
		if(this.drawing_mode === 'freehand'){
			
			// If user is drawing freehand, add the next coordinates
			// to the freehand_coords array
			this.freehand_coords.push(newMousePos);
			var all_x = this.freehand_coords.map(c=>c.x);
			var all_y = this.freehand_coords.map(c=>c.y);
			
			// Get minimum and maximum x and y points in the freehand drawing
			x = Math.min(...all_x);
			y = Math.min(...all_y);
			var max_x = Math.max(...all_x);
			var max_y = Math.max(...all_y);
			width = Math.max(0.1, Math.abs(x - max_x));
			height = Math.max(0.1, Math.abs(y - max_y));
		}else{
			x = Math.min(this.shape_start_pos.x, newMousePos.x);
			y = Math.min(this.shape_start_pos.y, newMousePos.y);
			width = Math.max(0.1, Math.abs(this.shape_start_pos.x - newMousePos.x));
			height = Math.max(0.1, Math.abs(this.shape_start_pos.y - newMousePos.y));
		}
		this.layer_dimensions = {x, y, width, height};
	}
	
	/**
	 * @ignore
	 * How to handle mouse input
	 */
	onmousemove(e){
		
		// If there isn't a drawing mode set let the parent class handle it
		if(!this.drawing_mode) return super.onmousemove(e);
		if(!this.is_mouse_down) return;
		
		// Clear the rendering canvas		
		this.rctx.clearRect(0, 0, this.width, this.height);
		
		// Get the current mouse position relative to the canvas
		const pos = this.canvasMousePos(e);
		
		// Update the layer_dimensions property
		this.recalculateLayerDimensions(pos);
		
		// Handle the mouse movement based on the active drawing mode...
		switch(this.drawing_mode){
			
			case "rectangle":
				var {x, y, width, height} = this.layer_dimensions;
				this.rctx.beginPath();
				this.rctx.rect(x, y, width, height);
				this.rctx.fill();
				this.rctx.stroke();
				this.renderLayer();
				break;
				
			case "ellipse":
				var {x, y, width, height} = this.layer_dimensions;
				this.drawEllipse(this.rctx, x, y, width, height);
				this.renderLayer();
				break;
				
			case "line":
				var x1 = this.shape_start_pos.x, 
					y1 = this.shape_start_pos.y, 
					x2 = pos.x, 
					y2 = pos.y;
				this.rctx.beginPath();
				this.rctx.moveTo(x1, y1);
				this.rctx.lineTo(x2, y2);
				this.rctx.fill();
				this.rctx.stroke(); 
				this.renderLayer();
				break;
				
			case "freehand":
				if(this.freehand_coords < 2) break;
				var a = this.freehand_coords[0];
				for(var i=1; i<this.freehand_coords.length; i++){
					this.rctx.beginPath();
					this.rctx.moveTo(a.x, a.y);
					this.rctx.lineTo(this.freehand_coords[i].x, this.freehand_coords[i].y);
					this.rctx.fill();
					this.rctx.stroke(); 
					a = this.freehand_coords[i];
				}
				this.renderLayer();
				break;
				
		}
	}
	
	/**
	 * @ignore
	 * On mousedown we set flags to render a new layer on mouse move
	 */
	onmousedown(e){
		if(!this.drawing_mode) return super.onmousedown(e);
		this.is_mouse_down = true;
		this.shape_start_pos = this.canvasMousePos(e);
	}
	
	/**
	 * @ignore
	 * on mouse up and when mouse runs out of the canvas reset everything
	 */
	onmousereset(e){
		if(!this.drawing_mode) return super.onmousereset(e);
		this.is_mouse_down = false;
		this.shape_start_pos = null;
		this.drawing_layer = null;
		this.layer_dimensions = null;
		this.freehand_coords = [];
	}
	
}

class CanvasFonts{}

CanvasFonts.getNative = async (force_recheck = false) => {
	
	if(CanvasFonts._native_available.length && !force_recheck){
		return CanvasFonts._native_available;
	}

	var _native_available = [];
	await document.fonts.ready;
	CanvasFonts._native_fontlist.forEach(font => {
		if (document.fonts.check(`12px "${font}"`)) {
			_native_available.push(font);
		}
	})

	CanvasFonts._native_available = [...new Set(_native_available)].sort();
	return CanvasFonts._native_available;
};

CanvasFonts.getDownloaded = async (force_recheck = false) => {
	if(CanvasFonts._downloaded_available.length && !force_recheck){
		return CanvasFonts._downloaded_available;
	}
	
	let {fonts} = document;
	const it = fonts.entries();

	let arr = [];
	let done = false;

	while (!done) {
		const font = it.next();
		if (!font.done) {
			
			var family;
			try{
				family = JSON.parse(font.value[0].family);
			}catch(e){
				family = font.value[0].family;
			}
			
			arr.push(family);
		} else {
			done = font.done;
		}
	}
	
	CanvasFonts._downloaded_available = [...new Set(arr)].sort();
	return CanvasFonts._downloaded_available;
};

CanvasFonts.getAvailable = async () => {
	var native = await CanvasFonts.getNative();
	var downloaded = await CanvasFonts.getDownloaded();
	return [...new Set([...native, ...downloaded])].sort();
};

CanvasFonts._native_available = [];
CanvasFonts._downloaded_available = [];
CanvasFonts._native_fontlist = [
	'Arial',
	'Arial Unicode MS',
	'Bitstream Cyberbit',
	'BitstreamCyberCJK',
	'Brampton',
	'Cardo',
	'Caslon Roman',
	'Charis SIL',
	'Chrysanthi Unicode',
	'Chryſanþi Unicode',
	'ClearlyU',
	'Code2000',
	'DejaVu Sans',
	'Doulos SIL',
	'Everson Mono',
	'Gentium Regular',
	'Gentium Plus',
	'GNU FreeFont',
	'Unifont',
	'GNU Unifont',
	'HAN NOM A',
	'HAN NOM B',
	'Horta',
	'Junicode',
	'Kelvinch',
	'Linux Libertine',
	'Lucida Grande',
	'Lucida Sans Unicode',
	'Microsoft JhengHei',
	'Microsoft Sans Serif',
	'New Gulim',
	'Noto',
	'PragmataPro',
	'Quivira',
	'Segoe UI Regular',
	'Squarish Sans CT',
	'STIX',
	'Sun-ExtA',
	'Sun-ExtB',
	'Tahoma',
	'Times New Roman',
	'TITUS Cyberbit Basic',
	'WenQuanYi Bitmap Song',
	'WenQuanYi Micro Hei',
	'WenQuanYi Zen Hei',
	'Y.OzFontN',
	'XITS',
	'Aharoni',
	'Aldhabi',
	'Andalus',
	'Angsana New',
	'AngsanaUPC',
	'Aparajita',
	'Arabic Typesetting',
	'Bahnschrift',
	'Batang',
	'BatangChe',
	'BIZ UDGothic',
	'BIZ UDPGothic',
	'BIZ UDMincho',
	'BIZ UDPMincho',
	'Book Antiqua',
	'Browallia New',
	'BrowalliaUPC',
	'Calibri',
	'Calisto MT',
	'Cambria',
	'Cambria Math',
	'Candara',
	'Century Gothic',
	'Comic Sans MS',
	'Consolas',
	'Constantia',
	'Copperplate Gothic',
	'Corbel',
	'Cordia New',
	'CordiaUPC',
	'Courier New',
	'DaunPenh',
	'David',
	'DengXian',
	'DilleniaUPC',
	'DFKai-SB',
	'DokChampa',
	'Dotum',
	'DotumChe',
	'Ebrima',
	'Estrangelo Edessa',
	'EucrosiaUPC',
	'Euphemia',
	'FangSong',
	'Franklin Gothic',
	'FrankRuehl',
	'FreesiaUPC',
	'Gabriola',
	'Gadugi',
	'Gautami',
	'Georgia',
	'Gisha',
	'Gulim',
	'GulimChe',
	'Gungsuh',
	'GungsuhChe',
	'HoloLens MDL2 Assets',
	'Impact',
	'Ink Free',
	'IrisUPC',
	'Iskoola Pota',
	'JasmineUPC',
	'Javanese Text',
	'SimKai',
	'KaiTi',
	'Kalinga',
	'Kartika',
	'Khmer UI',
	'KodchiangUPC',
	'Kokila',
	'Lao UI',
	'Latha',
	'Leelawadee',
	'Leelawadee UI',
	'Levenim MT',
	'LilyUPC',
	'Lucida Console',
	'Lucida Handwriting',
	'Malgun Gothic',
	'Mangal',
	'Marlett',
	'Meiryo',
	'Meiryo UI',
	'Microsoft Himalaya',
	'Microsoft JhengHei UI',
	'Microsoft New Tai Lue',
	'Microsoft PhagsPa',
	'Microsoft Tai Le',
	'Microsoft Uighur',
	'Microsoft YaHei',
	'Microsoft YaHei UI',
	'Microsoft Yi Baiti',
	'MingLiU',
	'PMingLiU',
	'MingLiU-ExtB',
	'PMingLiU-ExtB',
	'MingLiU_HKSCS',
	'MingLiU_HKSCS-ExtB',
	'Miriam',
	'Miriam Fixed',
	'Mongolian Baiti',
	'MoolBoran',
	'MS Gothic',
	'MS PGothic',
	'MS Mincho',
	'MS PMincho',
	'MS UI Gothic',
	'MV Boli',
	'Myanmar Text',
	'Narkisim',
	'Nirmala UI',
	'NSimSun',
	'Nyala',
	'Palatino Linotype',
	'Plantagenet Cherokee',
	'Raavi',
	'Rod',
	'Sakkal Majalla',
	'Sanskrit Text',
	'Segoe MDL2 Assets',
	'Segoe Print',
	'Segoe Script',
	'Segoe SD',
	'Segoe UI',
	'Segoe UI Emoji',
	'Segoe UI Historic',
	'Segoe UI Symbol',
	'Shonar Bangla',
	'Shruti',
	'SimHei',
	'Simplified Arabic',
	'SimSun',
	'SimSun-ExtB',
	'Sitka Banner',
	'Sitka Display',
	'Sitka Heading',
	'Sitka Small',
	'Sitka Subheading',
	'Sitka Text',
	'Sylfaen',
	'Symbol',
	'Traditional Arabic',
	'Trebuchet MS',
	'Tunga',
	'UD Digi Kyokasho',
	'Urdu Typesetting',
	'Utsaah',
	'Vani',
	'Verdana',
	'Vijaya',
	'Vrinda',
	'Webdings',
	'Wingdings',
	'Yu Gothic',
	'Yu Gothic UI',
	'Yu Mincho',
	'Al Bayan',
	'American Typewriter',
	'Andalé Mono',
	'Apple Casual',
	'Apple Chancery',
	'Apple Garamond',
	'Apple Gothic',
	'Apple LiGothic',
	'Apple LiSung',
	'Apple Myungjo',
	'Apple Symbols',
	'.AquaKana',
	'Arial Hebrew',
	'Ayuthaya',
	'Baghdad',
	'Baskerville',
	'Beijing',
	'BiauKai',
	'Big Caslon',
	'Brush Script',
	'Chalkboard',
	'Chalkduster',
	'Charcoal',
	'Charcoal CY',
	'Chicago',
	'Cochin',
	'Comic Sans',
	'Cooper',
	'Copperplate',
	'Corsiva Hebrew',
	'Courier',
	'DecoType Naskh',
	'Devanagari',
	'Didot',
	'Euphemia UCAS',
	'Futura',
	'Gadget',
	'Geeza Pro',
	'Geezah',
	'Geneva',
	'Geneva CY',
	'Gill Sans',
	'Gujarati',
	'Gung Seoche',
	'Gurmukhi',
	'Hangangche',
	'HeadlineA',
	'Hei',
	'Helvetica',
	'Helvetica CY',
	'Helvetica Neue',
	'Herculanum',
	'Hiragino Kaku Gothic Pro',
	'Hiragino Kaku Gothic ProN',
	'Hiragino Kaku Gothic Std',
	'Hiragino Kaku Gothic StdN',
	'Hiragino Maru Gothic Pro',
	'Hiragino Maru Gothic ProN',
	'Hiragino Mincho Pro',
	'Hiragino Mincho ProN',
	'Hoefler Text',
	'Inai Mathi',
	'Jung Gothic',
	'Kai',
	'Keyboard',
	'Krungthep',
	'KufiStandard GK',
	'Kuenstler Script',
	'LastResort',
	'LiHei Pro',
	'LiSong Pro',
	'Lucida Sans',
	'Marker Felt',
	'Menlo',
	'Monaco',
	'Monaco CY',
	'Mshtakan',
	'Nadeem',
	'New Peninim',
	'New York',
	'NISC GB18030',
	'Optima',
	'Osaka',
	'Palatino',
	'Papyrus',
	'PC Myungjo',
	'Pilgiche',
	'Raanana',
	'Sand',
	'Sathu',
	'Seoul',
	'Shin Myungjo Neue',
	'Silom',
	'Skia',
	'Snell Roundhand',
	'ST FangSong',
	'ST FangSong 2',
	'ST Heiti',
	'ST Kaiti',
	'ST Song',
	'Tae Graphic',
	'Taipei',
	'Techno',
	'Textile',
	'Thonburi',
	'Times',
	'Times CY',
	'Zapf Chancery',
	'Zapf Dingbats',
	'Zapfino',
];

class CanvasKeyLogger{

	constructor(options){
		// The element to attach the listener to.
		this.element = options.element || document;

		// An array of characters that represent keys pressed
		this.input = [];

		// The current cursor position in the input array
		this.cursor_pos = 0;

		// Flag to indicate if the keylogger is logging keys or not
		this.enabled = false;

		// What event type to use for logging
		this.event_type = options.event_type || 'keydown';

		// The event handler that does all the work...
		this._key_event_handler = this.key_event_handler.bind(this);

		// Various optional user specified event listeners
		this.on_input = (options.on_input || function(){}).bind(this);
		this.on_nav_key = (options.on_nav_key || function(){}).bind(this);

		// If there is an autostart option set to false, don't start logging immediately
		if(!options.hasOwnProperty('autostart') || options.autostart !== false){
			this.enable();
		}

	}

	key_event_handler(e){
		
		if(CanvasKeyLogger.NAMED_INPUT_KEYS[e.key]){
			input.splice(this.cursor_pos, 0, CanvasKeyLogger.NAMED_INPUT_KEYS[e.key]);
			this.cursor_pos++;
			this.on_input();
		}

		else if(CanvasKeyLogger.CONTROL_KEYS.includes(e.key)){
			switch(e.key){

				case 'ArrowDown': 
					this.on_nav_key();
					break;

				case 'ArrowLeft':
					if(this.cursor_pos > 0){
						this.cursor_pos--;
					}
					this.on_nav_key();
					break;

				case 'ArrowRight':
					if(this.input.length > this.cursor_pos){
						this.cursor_pos++;
					}
					this.on_nav_key();
					break;

				case 'ArrowUp':
					this.on_nav_key();
					break;

				case 'End':
					this.cursor_pos = this.input.length - 1;
					this.on_nav_key();
					break;

				case 'Home':
					this.cursor_pos = 0;
					this.on_nav_key();
					break;

				case 'Backspace':
					if(this.cursor_pos > 0){
						this.input.splice(this.cursor_pos-1, 1);
						this.cursor_pos--;
						this.on_input();
					}
					break;

				case 'Delete':
					if(this.input.length > this.cursor_pos){
						this.input.splice(this.cursor_pos, 1);
						this.on_input();
					}
					break;

			}
		}

		else if(!CanvasKeyLogger.NON_INPUT_KEYS.includes(e.key)){
			this.input.splice(this.cursor_pos, 0, e.key);
			this.cursor_pos++;
			this.on_input();
		}
	}

	val(as_array=false, cursor='CURSOR'){
		if(as_array){
			var value = [], i;
			for(i=0; i < this.input.length; i++){
				if(i == this.cursor_pos) value.push(cursor);
				value.push(this.input[i]);
			}
			if(i == this.cursor_pos) value.push(cursor);
			return value;
		}else{
			return this.input.join('');
		}
	}

	enable(){
		this.enabled = true;
		this.element.addEventListener(this.event_type, this._key_event_handler);
	}

	disable(){
		this.enabled = false;
		this.element.removeEventListener(this.event_type, this._key_event_handler);
	}

}

CanvasKeyLogger.NAMED_INPUT_KEYS = {Enter: "\n", Tab: "\t"};

CanvasKeyLogger.CONTROL_KEYS = ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp',
	'End', 'Home', 'Backspace', 'Delete'];

CanvasKeyLogger.NON_INPUT_KEYS = ['Unidentified', 'Alt', 'AltGraph', 'CapsLock', 'Control',
	'Fn', 'FnLock', 'Hyper', 'Meta', 'NumLock', 'ScrollLock', 'Shift', 'Super',
	'Symbol', 'SymbolLock', 'PageDown', 'PageUp', 'Clear', 'Copy', 'CrSel',
	'Cut', 'EraseEof', 'ExSel', 'Insert', 'Paste', 'Redo', 'Undo', 'Accept',
	'Again', 'Attn', 'Cancel', 'ContextMenu', 'Escape', 'Execute', 'Find',
	'Finish', 'Help', 'Pause', 'Play', 'Props', 'Select', 'ZoomIn', 'ZoomOut',
	'BrightnessDown', 'BrightnessUp', 'Eject', 'LogOff', 'Power', 'PowerOff',
	'PrintScreen', 'Hibernate', 'Standby', 'WakeUp', 'AllCandidates', 'Alphanumeric',
	'CodeInput', 'Compose', 'Convert', 'Dead', 'FinalMode', 'GroupFirst', 'GroupLast',
	'GroupNext', 'GroupPrevious', 'ModeChange', 'NextCandidate', 'NonConvert',
	'PreviousCandidate', 'Process', 'SingleCandidate', 'HangulMode', 'HanjaMode',
	'JunjaMode', 'Eisu', 'Hankaku', 'Hiragana', 'HiraganaKatakana', 'KanaMode',
	'KanjiMode', 'Katakana', 'Romaji', 'Zenkaku', 'ZenkakuHanaku', 'F1',
	'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
	'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'Soft1', 'Soft2',
	'Soft3', 'Soft4', 'AppSwitch', 'Call', 'Camera', 'CameraFocus', 'EndCall',
	'GoBack', 'GoHome', 'HeadsetHook', 'LastNumberRedial', 'Notification',
	'MannerMode', 'VoiceDial', 'ChannelDown', 'ChannelUp', 'MediaFastForward',
	'MediaPause', 'MediaPlay', 'MediaPlayPause', 'MediaRecord', 'MediaRewind',
	'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious', 'AudioBalanceLeft',
	'AudioBalanceRight', 'AudioBassDown', 'AudioBassBoostDown', 'AudioBassBoostToggle',
	'AudioBassBoostUp', 'AudioBassUp', 'AudioFaderFront', 'AudioFaderRear',
	'AudioSurroundModeNext', 'AudioTrebleDown', 'AudioTrebleUp', 'AudioVolumeDown',
	'AudioVolumeMute', 'AudioVolumeUp', 'MicrophoneToggle', 'MicrophoneVolumeDown',
	'MicrophoneVolumeMute', 'MicrophoneVolumeUp', 'TV', 'TV3DMode', 'TVAntennaCable',
	'TVAudioDescription', 'TVAudioDescriptionMixDown', 'TVAudioDescriptionMixUp',
	'TVContentsMenu', 'TVDataService', 'TVInput', 'TVInputComponent1', 'TVInputComponent2',
	'TVInputComposite1', 'TVInputComposite2', 'TVInputHDMI1', 'TVInputHDMI2',
	'TVInputHDMI3', 'TVInputHDMI4', 'TVInputVGA1', 'TVMediaContext', 'TVNetwork',
	'TVNumberEntry', 'TVPower', 'TVRadioService', 'TVSatellite', 'TVSatelliteBS',
	'TVSatelliteCS', 'TVSatelliteToggle', 'TVTerrestrialAnalog', 'TVTerrestrialDigital',
	'TVTimer', 'AVRInput', 'AVRPower', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow',
	'ColorF3Blue', 'ColorF4Grey', 'ColorF5Brown', 'ClosedCaptionToggle',
	'Dimmer', 'DisplaySwap', 'DVR', 'Exit', 'FavoriteClear0', 'FavoriteClear1',
	'FavoriteClear2', 'FavoriteClear3', 'FavoriteRecall0', 'FavoriteRecall1',
	'FavoriteRecall2', 'FavoriteRecall3', 'FavoriteStore0', 'FavoriteStore1',
	'FavoriteStore2', 'FavoriteStore3', 'Guide', 'GuideNextDay', 'GuidePreviousDay',
	'Info', 'InstantReplay', 'Link', 'ListProgram', 'LiveContent', 'Lock',
	'MediaApps', 'MediaAudioTrack', 'MediaLast', 'MediaSkipBackward', 'MediaSkipForward',
	'MediaStepBackward', 'MediaStepForward', 'MediaTopMenu', 'NavigateIn',
	'NavigateNext', 'NavigateOut', 'NavigatePrevious', 'NextFavoriteChannel',
	'NextUserProfile', 'OnDemand', 'Pairing', 'PinPDown', 'PinPMove', 'PinPToggle',
	'PinPUp', 'PlaySpeedDown', 'PlaySpeedReset', 'PlaySpeedUp', 'RandomToggle',
	'RcLowBattery', 'RecordSpeedNext', 'RfBypass', 'ScanChannelsToggle',
	'ScreenModeNext', 'Settings', 'SplitScreenToggle', 'STBInput', 'STBPower',
	'Subtitle', 'Teletext', 'VideoModeNext', 'Wink', 'ZoomToggle', 'SpeechCorrectionList',
	'SpeechInputToggle', 'Close', 'New', 'Open', 'Print', 'Save', 'SpellCheck',
	'MailForward', 'MailReply', 'MailSend', 'LaunchCalculator', 'LaunchCalendar',
	'LaunchContacts', 'LaunchMail', 'LaunchMediaPlayer', 'LaunchMusicPlayer',
	'LaunchMyComputer', 'LaunchPhone', 'LaunchScreenSaver', 'LaunchSpreadsheet',
	'LaunchWebBrowser', 'LaunchWebCam', 'LaunchWordProcessor', 'LaunchApplication1',
	'LaunchApplication2', 'LaunchApplication3', 'LaunchApplication4', 'LaunchApplication5',
	'LaunchApplication6', 'LaunchApplication7', 'LaunchApplication8', 'LaunchApplication9',
	'LaunchApplication10', 'LaunchApplication11', 'LaunchApplication12', 'LaunchApplication13',
	'LaunchApplication14', 'LaunchApplication15', 'LaunchApplication16', 'BrowserBack',
	'BrowserFavorites', 'BrowserForward', 'BrowserHome', 'BrowserRefresh', 'BrowserSearch',
	'BrowserStop', 'Decimal', 'Key11', 'Key12', 'Multiply', 'Add', 'Clear',
	'Divide', 'Subtract', 'Separator'
];

class TypingCanvas extends DrawingCanvas{
	
	constructor(canvas, opts={}){
		super(canvas, opts);
		
		// Font style options
		this.font_face = opts.font_face || null;
		this.font_color = opts.font_color || null;
		this.font_size = opts.font_size || null;
		
		// Flag to indicate if the user has finished defining the boundary box
		this.boundry_defined = false;
		
		// The keylogger utlity that captures keyboard input
		this.keylogger = null;
		
		// Flag that updates every fraction of a second to indicate 
		// if the flashing cursor is currently visible, 
		// when the textarea is active
		this.flashing_cursor_visible = false;
		
		// The timer that changes the state of this.flashing_cursor_visible
		this.flashing_cursor_timer = null;
		
		// We need a mouseup event listener to know when the boundary is drawn...
		this.canvas.addEventListener('mouseup', this.onmouseup.bind(this));
		
		document.body.appendChild(this.ccanvas);
		document.body.appendChild(this.rcanvas);
	}
	
	/**
	 * @ignore
	 */
	onmousemove(e){
		if(this.drawing_mode !== 'text') return super.onmousemove(e);
		if(!this.is_mouse_down) return;
		
		this.rctx.clearRect(0, 0, this.width, this.height);
		const pos = this.canvasMousePos(e);
		this.recalculateLayerDimensions(pos);
		this.drawBoundary();
	}
	
	/**
	 * Draws the text boundary rectangle
	 * @returns {undefined}
	 */
	drawBoundary(){
		var {x, y, width, height} = this.layer_dimensions;
		
		this.rctx.save();
		this.rctx.lineWidth = 3;
		this.rctx.strokeStyle = '#000 dashed';
		this.rctx.fillStyle = null;
		this.rctx.setLineDash([5, 15]);
		this.rctx.beginPath();
		this.rctx.rect(x, y, width, height);
		this.rctx.fill();
		this.rctx.stroke();
		this.rctx.restore();
		this.renderLayer();
	}
	
	/**
	 * @ignore
	 * On mousedown we set flags to render a new layer on mouse move
	 */
	onmousedown(e){
		if(this.drawing_mode !== 'text') return super.onmousedown(e);

		// If there is NOT an active drawing layer, start one
		if(!this.drawing_layer){
			
			var {x, y} = this.canvasMousePos(e);
			var layer = this.getLayerAt(x, y);
			if(layer && layer.properties.is_text_layer){
				// selecting the clicked on text layer
				this.editTextLayer(layer);
			}else{
				// starting a new boundary box
				this.is_mouse_down = true;
				this.shape_start_pos = this.canvasMousePos(e);
			}
			
		}else{
			
			var {x, y} = this.canvasMousePos(e);
			this.setCursor(x, y);
			if(this.isNearActiveRotatePoint(x, y)){
				if(this.fireEvent('layer-rotate-start')){
					this.activeLayerRotateStartPos = {x, y};
					this.rotatingActiveLayer = true;
				}
			}else if(this.isNearActiveCorner(x, y)){
				if(this.fireEvent('layer-resize-start')){
					this.resizingActiveLayer = true;
				}
			}else{
				
				var layer = this.getLayerAt(x, y);
				if(layer !== this.drawing_layer){
					// User clicked outside the text layer, reset the drawing mode
					this.resetTextEditor();
				}
				
			}
			
		}
	}
	
	/**
	 * Edit the provided text layer
	 * @ignore
	 */
	editTextLayer(layer){
		this.drawing_layer = layer;
		this.boundry_defined = true;
		
		var x_diff = layer.properties.last_position.x - layer.x;
		var y_diff = layer.properties.last_position.y - layer.y;
		
		this.layer_dimensions = layer.properties.layer_dimensions;
		this.layer_dimensions.x -= x_diff;
		this.layer_dimensions.y -= y_diff;
		
		this.shape_start_pos = layer.properties.shape_start_pos;
		this.shape_start_pos.x -= x_diff;
		this.shape_start_pos.y -= y_diff;
		
		this.font_face = layer.properties.font_face;
		this.font_size = layer.properties.font_size;
		this.font_color = layer.properties.font_color;
		
		this.activateTypeArea();
		this.keylogger.input = layer.properties.keylogger_input;
		this.keylogger.cursor_pos = this.keylogger.input.length;
		this.renderTypeArea();
	}
	
	/**
	 * Deselect any active layers and disable any editable textareas on the canvas.
	 * @returns {undefined}
	 */
	deSelectLayer(){
		super.deSelectLayer();
		this.resetTextEditor();
	}
	
	renderLayer(){
		super.renderLayer();
		this.drawing_layer.properties.is_text_layer = true;
		this.drawing_layer.properties.font_face = this.font_face;
		this.drawing_layer.properties.font_size = this.font_size;
		this.drawing_layer.properties.font_color = this.font_color;
		this.drawing_layer.properties.shape_start_pos = this.shape_start_pos;
		this.drawing_layer.properties.layer_dimensions = this.layer_dimensions;
		this.drawing_layer.properties.keylogger_input = this.keylogger ? this.keylogger.input : [];
		this.drawing_layer.properties.last_position = {
			x: this.drawing_layer.x,
			y: this.drawing_layer.y
		};
	}
	
	/**
	 * Draw the active type area
	 * @returns {undefined}
	 */
	renderTypeArea(active=true){
		var is_text_layer_active = this.drawing_layer && this.drawing_layer.properties.is_text_layer;
		
		this.rctx.clearRect(0, 0, this.width, this.height);
		if(active && is_text_layer_active){
			this.drawBoundary();
		}
		
		if(is_text_layer_active){
			this.rctx.save();
			var style = [];
			if(this.font_size) style.push(this.font_size+"px")
			if(this.font_face) style.push(this.font_face);
			if(style.length) this.rctx.font = style.join(' ');
			if(this.font_color) this.rctx.fillStyle = this.font_color;
			var text = this.keylogger.val(true, active && this.flashing_cursor_visible ? "|" : '').join('');
			this.rctx.textBaseline = "top";

			this.rctx.fillText(text, this.shape_start_pos.x, this.shape_start_pos.y);
			this.rctx.restore();
			this.renderLayer();
		}
		
		
	}
	
	/**
	 * Begin rendeing the typing area...
	 * @returns {undefined}
	 */
	activateTypeArea(){
		if(this.flashing_cursor_timer !== null) return;
		this.keylogger = new CanvasKeyLogger({
			on_input: () => {
				if(this.drawing_layer){
					this.drawing_layer.properties.text = this.keylogger.val();
				}
				this.renderTypeArea();
			}
		});
		this.flashing_cursor_timer = setInterval(()=>{
			this.flashing_cursor_visible = !this.flashing_cursor_visible;
			this.renderTypeArea();
		}, 333);
	}
	
	/**
	 * User clicked outside the active text layer, 
	 * reset all the flags and drawing_mode
	 * @returns {undefined}
	 */
	resetTextEditor(){
		this.renderTypeArea(false);
		this.drawing_layer = null;
		this.layer_dimensions = null;
		this.boundry_defined = false;
		this.flashing_cursor_visible = false;
		if(this.flashing_cursor_timer){
			clearInterval(this.flashing_cursor_timer);
			this.flashing_cursor_timer = null;
		}
		if(this.keylogger){
			this.keylogger.disable();
			this.keylogger = null;
		}
		this.shape_start_pos = null;
	}
	
	onmouseup(){
		if(this.drawing_mode !== 'text' || this.boundry_defined) return;
		if(this.shape_start_pos !== null){
			this.boundry_defined = true;
			this.activateTypeArea();
		}
	}
	
	/**
	 * @ignore
	 * on mouse up and when mouse runs out of the canvas reset everything
	 */
	onmousereset(e){
		if(this.drawing_mode !== 'text') return super.onmousereset(e);
		this.is_mouse_down = false;
	}
	
}