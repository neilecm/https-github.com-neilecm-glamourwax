import React from 'react';

interface Review {
  id: number;
  username: string;
  date: string;
  text: string;
  likes: number;
  mediaDuration?: string;
  isSubscriber?: boolean;
}

const reviewsData: Review[] = [
    {
        id: 1,
        username: 'kovecoshop',
        date: '2020-03-19',
        text: 'coba berkali2, awalnya msh bingung. Ternyata hrs di aplikasiin pas baru bgt diangkat karna dia cepet bgt keringnya, paling tiup tiup dikit 5 detik gt. Lets see ada efek samping apa nggak. Gak semuanya keangkat bulunya, emg hrs tebel dan dicoba beberapa kali. Pengriman & packaging oke.',
        likes: 7,
    },
    {
        id: 2,
        username: 'n*****5',
        date: '2022-02-16',
        text: "Efektivitas: bagus buat nyabut bulu\nKualitas: oke\nHarga: okee\nBuat yang baru pertama kali pake hardwax, sumpah kaget sesakit ini. \nBiasanya pake sugar wax ga begitu sakit, tapi ini sakit bgt dan lengket. 70/100 👌🏻",
        likes: 3,
        mediaDuration: '0:04',
    },
    {
        id: 3,
        username: 't*****8',
        date: '2020-12-15',
        text: 'Terimakasih barangnya bagus. Recomended seller. Kind and nice seller. Thank you for your being nice. Responnya juga cepat. Sesuai barangnya.',
        likes: 6,
        mediaDuration: '0:15',
    },
    {
        id: 4,
        username: 'Anonymous User',
        date: '2020-12-06',
        text: 'Produk oke, pengiriman juga cepat. Seller memandu dengan baik menjelaskan sampai paham. Pengaplikasian memang harus agak tebal dan cepat karena cepat mengering dan patah, untuk pemula kaya aku bisa kok kecabut semua. Mantap!!',
        likes: 2,
        mediaDuration: '0:10',
    },
    {
        id: 5,
        username: 'erlane.ef',
        date: '2019-12-08',
        text: 'Order ke 2x nya di sini. Pengiriman cepat,seller cepat tanggap,barang nya bagus banget. Dapet 1 spatula. Wax nya murah banget ❤️❤️❤️. Bau nya mirip jahe ,overall enak ,thankyou❤️❤️👌👌😊😊',
        likes: 3,
        isSubscriber: true,
    },
];

const StarRating: React.FC = () => (
    <div className="flex text-yellow-400">
        {[...Array(5)].map((_, i) => (
            <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        ))}
    </div>
);

const ReviewCard: React.FC<{ review: Review }> = ({ review }) => (
    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col h-full">
        <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            </div>
            <div>
                <div className="flex items-center">
                    <p className="font-bold">{review.username}</p>
                    {review.isSubscriber && <span className="ml-2 text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-semibold">Langganan</span>}
                </div>
                <p className="text-sm text-gray-500">{review.date}</p>
            </div>
        </div>
        <StarRating />
        <p className="text-gray-700 my-4 flex-grow whitespace-pre-line">{review.text}</p>
        
        {review.mediaDuration && (
            <div className="relative bg-gray-900 rounded-lg overflow-hidden h-32 flex items-center justify-center mb-4 text-white">
                <p className="text-lg font-bold">Media Preview</p>
                <div className="absolute inset-0 bg-black bg-opacity-40"></div>
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 px-2 py-1 text-xs rounded">
                    {review.mediaDuration}
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 absolute text-white opacity-80" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
            </div>
        )}

        <div className="flex items-center text-gray-500 mt-auto pt-4 border-t">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            <span>{review.likes}</span>
        </div>
    </div>
);


const ReviewsView: React.FC = () => {
    return (
        <div>
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800">What Our Customers Say</h1>
                <p className="text-lg text-gray-600 mt-4">Real reviews from real users of Cera Brasileira.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {reviewsData.map(review => (
                    <ReviewCard key={review.id} review={review} />
                ))}
            </div>
        </div>
    );
};

export default ReviewsView;