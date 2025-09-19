// Optimized Resource Loader
// Handles lazy loading of external dependencies

class ResourceLoader {
    constructor() {
        this.loaded = new Set();
        this.loading = new Set();
    }

    async loadCSS(url, id = null) {
        if (this.loaded.has(url)) return;
        
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            if (id) link.id = id;
            
            link.onload = () => {
                this.loaded.add(url);
                resolve();
            };
            link.onerror = reject;
            
            document.head.appendChild(link);
        });
    }

    async loadScript(url, id = null) {
        if (this.loaded.has(url)) return;
        if (this.loading.has(url)) {
            // Wait for existing load to complete
            return new Promise(resolve => {
                const checkLoaded = () => {
                    if (this.loaded.has(url)) resolve();
                    else setTimeout(checkLoaded, 10);
                };
                checkLoaded();
            });
        }

        this.loading.add(url);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            if (id) script.id = id;
            
            script.onload = () => {
                this.loaded.add(url);
                this.loading.delete(url);
                resolve();
            };
            script.onerror = () => {
                this.loading.delete(url);
                reject(new Error(`Failed to load script: ${url}`));
            };
            
            document.head.appendChild(script);
        });
    }

    async loadDataTables() {
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) {
            return; // Already loaded
        }

        try {
            // Load CSS first
            await Promise.all([
                this.loadCSS('https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css'),
                this.loadCSS('https://cdn.datatables.net/buttons/2.4.1/css/buttons.dataTables.min.css')
            ]);

            // Load jQuery first if not present
            if (!window.jQuery) {
                await this.loadScript('https://code.jquery.com/jquery-3.7.1.min.js');
            }

            // Load DataTables and dependencies
            await Promise.all([
                this.loadScript('https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js'),
                this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'),
                this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js'),
                this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js')
            ]);

            // Load DataTables extensions
            await Promise.all([
                this.loadScript('https://cdn.datatables.net/buttons/2.4.1/js/dataTables.buttons.min.js'),
                this.loadScript('https://cdn.datatables.net/buttons/2.4.1/js/buttons.html5.min.js'),
                this.loadScript('https://cdn.datatables.net/buttons/2.4.1/js/buttons.print.min.js')
            ]);

            console.log('✅ DataTables loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load DataTables:', error);
            throw error;
        }
    }

    async loadChartJS() {
        if (window.Chart) return; // Already loaded

        try {
            await Promise.all([
                this.loadScript('https://cdn.jsdelivr.net/npm/chart.js'),
                this.loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2')
            ]);
            console.log('✅ Chart.js loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load Chart.js:', error);
            throw error;
        }
    }

    async loadSweetAlert() {
        if (window.Swal) return; // Already loaded

        try {
            await Promise.all([
                this.loadCSS('https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css'),
                this.loadScript('https://cdn.jsdelivr.net/npm/sweetalert2@11')
            ]);
            console.log('✅ SweetAlert2 loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load SweetAlert2:', error);
            throw error;
        }
    }
}

// Global instance
window.ResourceLoader = new ResourceLoader();

export default ResourceLoader;