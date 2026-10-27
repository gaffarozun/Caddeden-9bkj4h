import { useLocalSearchParams } from 'expo-router';
import { ComplaintEmailView } from '@/components/feature/ComplaintEmailView';
export default function ComplaintScreen(){
 const params=useLocalSearchParams<{context?:string}>();
 return <ComplaintEmailView context={typeof params.context==='string'?params.context.slice(0,300):''}/>;
}
