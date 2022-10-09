const Homey = require('homey'); // eslint-disable-line import/no-unresolved
const http = require('http.min');

class MELCloudDeviceMixin extends Homey.Device {
  async fetchEnergyReport() {
    this.homey.clearTimeout(this.reportTimeout);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const toDate = `${yesterday.toISOString().split('T')[0]}T00:00:00`;

    const data = this.getData();
    const options = {
      uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/EnergyCost/Report',
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: {
        DeviceId: data.id,
        ToDate: toDate,
        UseCurrency: false,
      },
    };

    const fromDates = {
      daily: toDate,
      total: '1970-01-01T00:00:00',
    };
    Object.entries(fromDates).forEach(async (entry) => {
      const [period, fromDate] = entry;
      try {
        this.log(`\`${this.getName()}\`: fetching ${period} energy report...`);

        options.json.FromDate = fromDate;
        const report = {};
        report[period] = await http.post(options).then((result) => {
          if (result.response.statusCode !== 200) {
            throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
          }
          this.log(result.data);
          if (result.data.ErrorMessage) {
            throw new Error(result.data.ErrorMessage);
          }
          return result.data;
        });
        await this.parseEnergyReport(report);

        this.reportTimeout = this.homey.setTimeout(this.fetchEnegyReport, 24 * 60 * 60 * 1000);
        this.log(`\`${this.getName()}\`: ${period} energy report has been successfully processed`);
      } catch (error) {
        if (error instanceof SyntaxError) {
          this.error(`\`${this.getName()}\`: device not found while fetching ${period} energy report`);
        } else {
          this.error(`\`${this.getName()}\`: a problem occurred while fetching ${period} energy report (${error})`);
        }
      }
    });
  }
}

module.exports = MELCloudDeviceMixin;
