class ElevationControl {

    constructor(feature) {
        var vertices = turf.explode(feature);
        vertices.features.forEach(vertex => {
            vertex.properties = {...vertex.properties};
        })
        vertices["features"].map((feature, index, features) => {
            index == 0 ? feature["properties"]["distance"] = 0 : 
                feature["properties"]["distance"] = turf.distance(features[index - 1], feature) + features[index - 1].properties.distance;
        });
        this._vertices = vertices;
        // console.log(vertices);
        this._data = vertices.features.map(feature => [feature.properties.distance, feature.geometry.coordinates[2]]);
    };

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        this._container.id = 'elevation-ctrl';
        var svgWidth = this._container.style.width = 500;
        var svgHeight = this._container.style.height = 500;

        // var element = d3.select('#elevation-ctrl');
        var element = d3.select(this._container);
        // heights and margins for svg, change later
        /* console.log(this._container.getBoundingClientRect());
        var svgWidth = element.node().getBoundingClientRect().width; 
        var svgHeight = element.node().getBoundingClientRect().height; 
        */
        // var svgHeight = document.documentElement.clientHeight > 500 ? document.documentElement.clientHeight : 500; 
        var margin = { top: 20, right: 20, bottom: 30, left: 50  };
        var width = svgWidth - margin.left - margin.right;
        var height = svgHeight - margin.top - margin.bottom;
        // select element, create svg container and set height/width attributes
        var svg = element.append('svg').style('display', 'block');
        svg.attr("width", svgWidth).attr("height", svgHeight);
        // create group to put plot within, translated by margins
        var g = svg.append("g")
            .attr("height", height)
            .attr("width", width)
            .attr("transform", `translate(${margin.left}, ${margin.top})`);
        // graph(data, g);
        this.drawChart(this._data, g);
        /*
        this._svg.append("path")
            .datum(this._data)
            .attr("fill", "steelblue")
            .attr("d", area);
        */
        return this._container;
    };
    
    drawChart(data, g) {
        // get height and width of parent element
        // offset also possible if necessary
        const offset = 0;
        const width = g.attr('width');
        console.log(width);
        const height = g.attr('height');
        const transform = g.attr('transform');
        // define scale, dimensions of svg to scale data to and domains, range of data values
        const x = d3.scaleLinear().range([0, width]).interpolate(d3.interpolateRound)
            .domain(d3.extent(data, d => d[0]));
        /*
        const y = d3.scaleLinear().range([height, 0]).interpolate(d3.interpolateRound)
            .domain(d3.extent(data, d => d[1]));
            */
        var extentY = d3.extent(data, d => d[1]);
        extentY[0] = extentY[0] - offset;
        const y = d3.scaleLinear().range([height, 0]).interpolate(d3.interpolateRound)
            .domain(extentY);
        // define line and area functions calling scale functions on each variable
        let area = d3.area()
            .x(d => x(d[0]))
            .y0(height)
            .y1(d => y(d[1]));
        let line = d3.line()
            .x(d => x(d[0]))
            .y(d => y(d[1]));
        // add polygon area path to group with predefined data and function
        g.append("path")
            .datum(data)
            .attr("class", "area")
            .attr("d", area);
        // add polygon line path to group with predefined data and function
        g.append("path")
            .datum(data)
            .attr("class", "line")
            .attr("d", line);
        // create group to store marker/dropdowns
        const focus = g.append('g')
            .attr('class', 'focus')
            .style('display', 'none');
        // add circle marker
        focus.append('circle')
            .attr('r', 4.5);
        // append x and y lines with respective classes 
        focus.append('line')
            .attr('class',  'x');
        focus.append('line')
            .attr('class',  'y');
        // appends rectangle over svg with event listners for mouseover, out, move
        g.append('rect')
            .attr('class', 'overlay')
            .attr('width', width)
            .attr('height', height)
            .on('mouseover', () => focus.style('display', null))
            .on('mouseout', () => focus.style('display', 'none'))
            .on('mousemove', this.mousemove);
        // style elements 
        g.selectAll('.line')
            .style('fill', 'none')
            .style('stroke', 'steelblue')
            .style('stroke-width', '1.5px');
        g.selectAll('.area')
            .style('fill', 'lightsteelblue')
        g.select('.overlay')
            .style('fill', 'none')
            .style('pointer-events', 'all');
        g.selectAll('.focus')
            .style('opacity', 0.7);
        g.selectAll('.focus circle')
            .style('fill', 'none')
            .style('stroke', 'black');
        g.selectAll('.focus line')
            .style('fill', 'none')
            .style('stroke', 'black')
            .style('stroke-width', '1.5px')
            .style('stroke-dasharray', '3 3');
    };

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    };

    mousemove(){
        // d3.mouse(this) returns [x, y] of mouse
        // x0 uses scale.invert to get real value from x value
        const x0 = x.invert(d3.mouse(this)[0]);
        // bisector gets nearest value to the left of d
        const bisectDistance = d3.bisector(d => d[0]).left;
        const i = bisectDistance(data, x0, 1);
        const d = data[i];
        // const i = bisectDate(data, x0, 1);
        // const d0 = data[i - 1];
        // const d1 = data[i];
        // const d = x0 - d0.date > d1.date - x0 ? d1 : d0;
        focus.attr('transform', `translate(${x(d[0])}, ${y(d[1])})`);
        focus.select('line.x')
            .attr('x1', 0)
            .attr('x2', -x(d[0]))
            .attr('y1', 0)
            .attr('y2', 0);

        focus.select('line.y')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', 0)
            .attr('y2', height - y(d[1]));
    };
}
