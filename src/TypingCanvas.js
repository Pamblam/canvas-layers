
class TypingCanvas extends DrawingCanvas{
	
	constructor(canvas, options){
		this.active = false;
		this.text = '';
		this.canvas = canvas;
		
		this.type_area = {};
		this.type_area.width = options.type_area.width || canvas.width;
		this.type_area.height = options.type_area.height || canvas.height;
		this.type_area.x = options.type_area.x || 0;
		this.type_area.y = options.type_area.y || 0;
		
		this._render_canvas = document.createElement('canvas');
		this._render_canvas.width = this.type_area.width;
		this._render_canvas.height = this.type_area.height;
		
		this.last_render_background = null;
		
		this._keydownHandler = this.keydownHandler.bind(this);
		this.attachEventHandlers();
	}
	
	setTypeArea(x, y, w, h){
		this.type_area.width = w;
		this.type_area.height = h;
		this.type_area.x = x;
		this.type_area.y = y;
	}
	
	keydownHandler(){
		
	}
	
	attachEventHandlers(){
		this.canvas.addEventListener(this._keydownHandler);
	}
	
	removeEventHandlers(){
		this.canvas.removeEventListener(this._keydownHandler);
	}
	
}