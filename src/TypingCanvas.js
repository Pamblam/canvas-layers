
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