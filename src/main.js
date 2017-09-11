import Vue from "vue";
import VMapbox from "./components/VMapbox";
import VMapboxLayer from "./components/VMapboxLayer";
// import VMapboxSlider from "./components/VMapboxSlider";
import VMapboxSource from "./components/VMapboxSource";
import VMapboxGeocoder from "./components/VMapboxGeocoder";
import VMapboxNavigationControl from "./components/VMapboxNavigationControl";
import Vuetify from "vuetify";

Vue.use(Vuetify);

import "normalize.css";
import "sanitize.css";
import "vuetify/dist/vuetify.min.css";
import "material-design-icons/iconfont/material-icons.css";
import "./main.scss";
/* eslint-disable no-new */
import mapboxgl from 'mapbox-gl';

var scenarios = require("./APIsources.js").scenarios()
Vue.component('modal', {
  template: '#modal-template'
})

function api_source(source_id){
  var baseurl = scenarios.find(x => x.id === source_id).baseurl
  var response= $.ajax({
      url: baseurl + '/locations?pagesize=100000',
      async: false
   }).responseJSON;

  var coordinates = _.map(response.results, 'geometry')
  var geojsonarray = []
  _.each(response.results, function(r){
      geojsonarray.push({"type": "Feature",
              "geometry": r.geometry,
              "properties": _.pick(r, 'uuid', 'url', 'code', 'name')})
  })
  var source = {
    // "id": source_id,
    "type": "geojson",
    "data": {
      "type": "FeatureCollection",
      "features": geojsonarray
    }
  }
  return source
}

function url_sources(scenarios){
  var s = []
  _.each(scenarios, (e) => {s.push(e.id)})
  return s
}

const vm = new Vue({
  el: "#app",
  data() {
    return {
      urls: url_sources(scenarios),
      selected: _.first(this.urls),
      // initialview: false,
      layers: [{
            "id": "aquadesk",
            "active": true,
            "type": "circle",
            "source": api_source("aquadesk"),
            "minzoom": 5,
            "layout": {
              "visibility": "none"
            },
            "paint": {
              "circle-radius": 8
            }
          },
          {
            "id": "fews",
            "active": true,
            "type": "circle",
            "source": api_source("fews"),
            "minzoom": 5,
            "layout": {
              "visibility": "none"
            },
            "paint": {
              "circle-radius": 8
            }

          }
      ],
      sources: []
      };
    },

  components: {
    "v-mapbox": VMapbox,
    "v-mapbox-layer": VMapboxLayer,
    "v-mapbox-source": VMapboxSource,
    "v-mapbox-geocoder": VMapboxGeocoder,
    "v-mapbox-navigation-control": VMapboxNavigationControl,
  },
  mounted() {
    this.$nextTick(() => {
      var popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false
      });

      _.each(this.layers, (layer) => {
        this.$refs.map.map.on('mouseleave', layer.id, () => {
            this.$refs.map.map.getCanvas().style.cursor = '';
            popup.remove();
        });
      });

      _.each(this.layers, (layer) => {
        this.$refs.map.map.on('click', layer.id, (e) => {
          $('#details').css('display', 'none')
          if (layer.id == 'fews'){var searchterm = 'uuid'}
          else{var searchterm = 'locationCode'}
          var response= $.ajax({
              url: scenarios.find(x => x.id === layer.id).baseurl + '/timeseries?' + searchterm + '=' + e.features[0].properties.code + '&pagesize=3000' ,
              async: false
           }).responseJSON;
          var t = $("table#results tbody").empty();
          $('.panel-heading').html("<h6> Information on " + e.features[0].properties.name + "<br>(Code: " + e.features[0].properties.code + ")</h6>")
          try{response.results.forEach(res => {
            if(typeof(res.observationType) == "string") {
              var obs= $.ajax({
                  url: res.observationType ,
                  async: false
               }).responseJSON;
               var quantity = obs.quantity
            }
            else{
              var quantity = res.observationType.quantity
            }
            $("<tr><td class='results'>" + quantity + " (" + res.observationType.parameterCode + ") </td></tr>" ).appendTo(t)
              .click(function(data) {
                $('#details').css('display', 'inline-block')
                $('#details').empty()
                $('#details').html()
                var plt = Bokeh.Plotting;
                var tools = "pan,crosshair,wheel_zoom,box_zoom,reset,save"
                var unit = res.observationType.unit

                var ydata= $.ajax({
                    url: res.url + '/data' ,
                    async: false
                 }).responseJSON;

                var x = []
                var y = []

                _.each(ydata, function(event){
                  try{x.push(new Date(event.timestamp.slice(0, 19)))}
                  catch(err){x.push(new Date(event.timeStamp.slice(0, 19)))}
                  y.push(event.value)
                });

                var startdate = new Date(x[0])
                var enddate = new Date(x.slice(-1)[0])
                var xdr = new Bokeh.Range1d({start: startdate.setDate(x[0].getDate() - 1),
                                             end: enddate.setDate(x.slice(-1)[0].getDate() + 1)})
                var source = new Bokeh.ColumnDataSource({ data: { x: x, y: y } });
                var plot = new plt.figure({
                    title: "Timeseries for " + res.observationType.quantity + " (" + res.observationType.parameterCode + ")",
                    tools: tools,
                    width: 400,
                    height: 200,
                    background_fill_color: "#F2F2F7",
                    x_axis_type: 'datetime',
                    y_axis_label: unit,
                    x_range: xdr
                  });

                var line = new Bokeh.Circle({
                    x: { field: "x" },
                    y: { field: "y" },
                    line_color: "#666699",
                    line_width: 2
                });
                plot.add_glyph(line, source);
                Bokeh.Plotting.show(plot, document.getElementById('details'));
              })
          });
        }
        catch(err){
          var t = $("table#results tbody").empty();
          t.text("No data detected.")
        }
          $('#list').css('display', 'block')
        });
      })

      _.each(this.layers, (layer) => {
        this.$refs.map.map.on("mouseenter", layer.id, (e) => {
        this.$refs.map.map.getCanvas().style.cursor = 'pointer';
        popup.setLngLat(e.lngLat)
          .setHTML("Location: " + e.features[0].properties.name + " (Code: " + e.features[0].properties.code+ ")")
          .addTo(this.$refs.map.map);
        });
      });
    });
  },
  watch: {
      selected(newScenario, oldScenario) {
          try{this.$refs.map.map.setLayoutProperty(oldScenario, "visibility", "none");}
          catch(err){}
          this.$refs.map.map.setLayoutProperty(newScenario, "visibility", "visible");
      }
    },
  computed: {},
  methods: {
  initialview() {
    this.$refs.map.map.setZoom("7.3")
    this.$refs.map.map.setPitch("38.50")
    this.$refs.map.map.setCenter("[5.507, 52.078]")
    this.$refs.map.map.setBearing("1.43")
    // this.initialview = null
  }}
});
