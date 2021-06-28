
class TypingCanvas extends DrawingCanvas{
	
	constructor(canvas, opts={}){
		super(canvas, opts);
		
		this.font_face = null;
		this.font_color = null;
		this.font_size = null;
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
	
}