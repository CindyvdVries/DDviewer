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

var scenarios = [
  {
    "id": "aquadesk",
    "baseurl": "http://digitaldelta.aquadesk.nl",
  },
  {
    "id": "fews",
    "baseurl": "http://tl-tc097.xtr.deltares.nl:8080/fews-web-services/digitaledelta/v1",
  }]

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
  console.log(source)
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

      layers: [{
            "id": "aquadesk",
            "active": true,
            "type": "circle",
            "source": api_source("aquadesk"),
            "minzoom": 5,
            "active": "false",
            "layout": {
              "visibility": "none"
            }
          },
          {
            "id": "fews",
            "active": true,
            "type": "circle",
            "source": api_source("fews"),
            "minzoom": 5,
            "active": "false",
            "layout": {
              "visibility": "none"
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
      this.$refs.map.map.on(
        "load", () => {
        // this.syncLayerVisibility();
        }
      )

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
          var response= $.ajax({
              url: scenarios.find(x => x.id === layer.id).baseurl + '/timeseries?locationCode=' + e.features[0].properties.code + '&pagesize=3000' ,
              async: false
           }).responseJSON;
          console.log(e.features[0].properties.code, e.features[0].properties.name)
          var t = $("table#results tbody").empty();
          $('.panel-heading').html("<h6> Information on " + e.features[0].properties.name + "<br>(Code: " + e.features[0].properties.code + ")</h6>")
          try{response.results.forEach(res => {
            $("<tr><td class='results'>" + res.observationType.quantity + " (" + res.observationType.parameterCode + ")" +  res.observationType.compartment +  res.observationType.qualifier + "</td></tr>" ).appendTo(t)
              .click(function(data) {
                $('#details').css('display', 'inline-block')
                $('#details').empty()
                $('#details').html()
                var plt = Bokeh.Plotting;
                var tools = "pan,crosshair,wheel_zoom,box_zoom,reset,save"
                var unit = res.observationType.uni

                var ydata= $.ajax({
                    url: res.url + '/data' ,
                    async: false
                 }).responseJSON;

                 var x = []
                 var y = []

                _.each(ydata, function(event){
                  x.push(new Date(event.timeStamp))
                  y.push(event.value)
                });

                var source = new Bokeh.ColumnDataSource({ data: { x: x, y: y } });
                var plot = new plt.figure({
                    title: "Timeseries for " + res.observationType.quantity + " (" + res.observationType.parameterCode + ")",
                    tools: tools,
                    width: 400,
                    height: 200,
                    background_fill_color: "#F2F2F7",
                    x_axis_type: 'datetime',
                    y_axis_label: unit
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
          try{
            this.$refs.map.map.setLayoutProperty(oldScenario, "visibility", "none");
          }
          catch(err){console.log(err)}
          this.$refs.map.map.setLayoutProperty(newScenario, "visibility", "visible");
      }
    },
  computed: {},
  methods: {}
});
// add watchers that are deep
vm.$watch(
  "layers",
  function(layers) {
    // vm.syncLayerVisibility();
  },
  {deep: true}
);
