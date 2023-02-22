using Aspose.Cells;
using Aspose.Cells.Utility;
using ImageProcessor.Processors;
using iTextSharp.text;
using iTextSharp.text.html;
using iTextSharp.text.pdf;
using Newtonsoft.Json;
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using System.Xml;
using Font = iTextSharp.text.Font;
using Image = iTextSharp.text.Image;
using Rectangle = iTextSharp.text.Rectangle;

namespace AzurePricingAPI
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            loadInfo();
        }

        Data data = new Data();

        List<string> list = new List<string>();

        private void addGrid(object sender, SelectionChangedEventArgs e)
        {
            Console.WriteLine(dataGrid.Columns.Count);
            dataGrid.ItemsSource = data.Items;
            DataGridTextColumn textColumn = new DataGridTextColumn();
            string text = ((sender as ListBox)?.SelectedItem as ListBoxItem)?.Content.ToString();

            textColumn.Header = text;
            list.Add(text);
            textColumn.Binding = new Binding(text);
            dataGrid.Columns.Add(textColumn);
            lb.SelectionChanged -= addGrid;
            lb.Items.Remove(lb.SelectedItem);
            lb.SelectionChanged += addGrid;
        }



        public void loadInfo()
        {
            var client = new HttpClient();
            HttpResponseMessage response = client.GetAsync($"https://prices.azure.com/api/retail/prices?api-version=2021-10-01-preview&meterRegion=primary").Result;
            var result = response.Content.ReadAsStringAsync().Result;
            data = JsonConvert.DeserializeObject<Data>(result);
            dataGrid.ItemsSource = null;
            lb.Items.SortDescriptions.Add(new System.ComponentModel.SortDescription("Content", System.ComponentModel.ListSortDirection.Ascending));
        }

        
        private void PDF(object sender, RoutedEventArgs e)
        {
            iTextSharp.text.Document document = new iTextSharp.text.Document(iTextSharp.text.PageSize.A2);
            PdfWriter writer = PdfWriter.GetInstance(document, new FileStream("Output.pdf", FileMode.Create));
            document.Open();

            //add logo in pdf
            string url = "https://www.2020spaces.com/wp-content/uploads/2020/06/Logo-2020-Design-Live-w-Icon-color.png";

            Image jpg = Image.GetInstance(new Uri(url));
            jpg.ScalePercent(24f);
            jpg.Alignment = Image.ALIGN_LEFT;
            document.Add(jpg);

           

            Font font5 = FontFactory.GetFont(FontFactory.COURIER, 8,Font.BOLD);
            int count = dataGrid.Columns.Count - 1;

            Console.WriteLine(count);

            PdfPTable table = new PdfPTable(count);

            table.WidthPercentage = 100;

            Font font = FontFactory.GetFont(FontFactory.COURIER_BOLDOBLIQUE, 20, Font.UNDERLINE, BaseColor.RED);
            var cell = new PdfPCell(new Phrase("Reports", font))
            {
                Colspan = dataGrid.Columns.Count,
                HorizontalAlignment = 100,
                MinimumHeight = 40f
            };
            cell.BackgroundColor = BaseColor.GREEN;
            cell.BorderColor = BaseColor.BLACK;
            cell.HorizontalAlignment = PdfPCell.ALIGN_CENTER;
            table.AddCell(cell);

            cell.Colspan = count;
            cell.PaddingLeft = count;

            Font font2 = FontFactory.GetFont(FontFactory.COURIER_BOLD, 10, Font.ITALIC, BaseColor.RED);
            for (int i = 1; i <= count; i++)
            {
                var cell2 = new PdfPCell(new Phrase(dataGrid.Columns[i].Header.ToString(), font2));
                BaseColor myColor = WebColors.GetRGBColor("#ADD8E6");
                cell2.BackgroundColor = myColor;
                cell2.BorderWidth = 1;  
                table.AddCell(cell2);
            }

            IEnumerable itemsSource = dataGrid.ItemsSource as IEnumerable;
            foreach (var item in itemsSource.OfType<Item>())
            {
                if (item.Check == false) continue;
                DataGridRow row = dataGrid.ItemContainerGenerator.ContainerFromItem(item) as DataGridRow;
                if (row != null)
                {
                    DataGridCellsPresenter presenter = FindVisualChild<DataGridCellsPresenter>(row);
                    for (int i = 1; i <= count; i++)
                    {

                        System.Windows.Controls.DataGridCell cell1 = (System.Windows.Controls.DataGridCell)presenter.ItemContainerGenerator.ContainerFromIndex(i);
                        TextBlock txt = cell1.Content as TextBlock;
                        if (txt != null)
                            table.AddCell(new Phrase(txt.Text, font5));
                    }

                }


            }
            document.Add(table);
            document.Close();
            MessageBox.Show("PDF Generated Please Find Source Folder");
        }

        private T FindVisualChild<T>(DependencyObject obj) where T : DependencyObject
        {
            for (int i = 0; i < VisualTreeHelper.GetChildrenCount(obj); i++)
            {
                DependencyObject child = VisualTreeHelper.GetChild(obj, i);
                if (child != null && child is T)
                    return (T)child;
                else
                {
                    T childOfChild = FindVisualChild<T>(child);
                    if (childOfChild != null)
                        return childOfChild;
                }
            }
            return null;
        }

        private void Reset(object sender, RoutedEventArgs e)
        {
            list.Sort();
            foreach (var item in list)
            {
                lb.Items.Add(item);
                
            }
            list.Clear();
            dataGrid.Columns.Clear();
            dataGrid.ItemsSource = null;
            DataGridCheckBoxColumn textColumn = new DataGridCheckBoxColumn();
            textColumn.Header = "Check";
            textColumn.Binding = new Binding("Check");

            
            dataGrid.Columns.Add(textColumn);
            Console.WriteLine(dataGrid.Columns);
        }

        private string Generate_Json()
        {
            var Itemss = dataGrid.ItemsSource as IList<Item>;
            var count = Itemss.Count;
            int j = 0;
            List<Dictionary<string, string>> dict = new List<Dictionary<string, string>>();
            for (int i = 0; i < count; i++)
            {
                var item = Itemss[j];
                if (item.Check == false)
                {
                    Itemss.RemoveAt(j);
                    j--;
                }
                j++;
            }
            foreach (var row in Itemss)
            {
                Dictionary<string, string> dic = new Dictionary<string, string>();
                System.Reflection.PropertyInfo propi = typeof(Item).GetProperty("Check"); //string type object get
                object value1 = propi.GetValue(row);
                if (value1.ToString() == "True")
                {
                    foreach (var col in dataGrid.Columns)
                    {
                        if (col.Header.ToString() == "Check") continue;
                        System.Reflection.PropertyInfo prop = typeof(Item).GetProperty(col.Header.ToString());

                        object value = prop.GetValue(row);

                        dic.Add(col.Header.ToString(), value.ToString());

                    }
                }
                dict.Add(dic);
            }

            var json = JsonConvert.SerializeObject(dict, Newtonsoft.Json.Formatting.Indented);
            return json;
        }

        private void JSON(object sender, RoutedEventArgs e)
        {
            var json = Generate_Json();
            //JObject jsondata = JObject.Parse(json);
            System.IO.File.WriteAllText("JSON.json", json);
            MessageBox.Show("JSON File Generated Please Find Source Folder");
        }

        private void XML(object sender, RoutedEventArgs e)
        {
            var json = Generate_Json();
            XmlDocument doc = (System.Xml.XmlDocument)Newtonsoft.Json.JsonConvert.DeserializeXmlNode("{\"Item \":" + json + "}", "Item"); //root error solve
            doc.Save("XML.xml");
            MessageBox.Show("XML File Generated Please Find Source Folder");
        }

        private void CSV(object sender, RoutedEventArgs e)
        {
            var json = Generate_Json();

            var workbook = new Workbook();

            // access default empty worksheet
            var worksheet = workbook.Worksheets[0];

            // set JsonLayoutOptions for formatting
            var layoutOptions = new JsonLayoutOptions();
            layoutOptions.ArrayAsTable = true;

            // import JSON data to CSV
            JsonUtility.ImportData(json, worksheet.Cells, 0, 0, layoutOptions);

            // save CSV file
            workbook.Save("CSV.csv", SaveFormat.Csv);
            MessageBox.Show("Csv File Generated Please Find Source Folder");
        }
    }
}
